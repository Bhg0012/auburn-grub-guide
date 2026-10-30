#!/usr/bin/env node
// Turns requests sent from the app into guide updates. Runs in GitHub Actions
// (.github/workflows/app-requests.yml) whenever the app opens an issue.
//
//   rate    rate a To Try spot          -> Claude Haiku (moves it, tidies comments)
//   rerate  change a rated spot         -> Claude Haiku
//   add     put a new place on To Try   -> Claude Sonnet (researches photos and details)
//   ratenew rate a place we never listed -> Claude Sonnet
//
// Every open request from the repo owner is handled oldest first, one at a time,
// so nothing is lost if several are sent at once. Each one is validated,
// committed and pushed to main, then the issue is closed with a short result.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = process.env.GITHUB_REPOSITORY;
const OWNER = (REPO || '').split('/')[0];
const GH_TOKEN = process.env.GITHUB_TOKEN;
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;
const MARKER = 'grub-guide-request';
const HAIKU = 'claude-haiku-5-5';
const SONNET = 'claude-sonnet-5-5';
const SONNET_BUDGET_USD = 2;
const TYPES = ['rate', 'rerate', 'add', 'ratenew'];

const PLACES = join(ROOT, 'data/places.json');
const WISH = join(ROOT, 'data/wishlist.json');

/* ---------- small helpers ---------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const noDash = (s) => String(s).replace(/\s*\u2014\s*/g, ' - ');
const clip = (s, n) => noDash(String(s ?? '').trim()).slice(0, n);

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
// Same layout as the hand-edited files (2-space JSON, ratings keep their ".0").
const writeJson = (f, data) => writeFileSync(f, `${JSON.stringify(data, null, 2).replace(/("rating": )(\d+)(,?)$/gm, '$1$2.0$3')}\n`);

// Local Auburn time, like the "added" stamps written by hand.
function nowLocal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function resetToMain() {
  git('fetch', '--quiet', 'origin', 'main');
  git('reset', '--quiet', '--hard', 'origin/main');
  git('clean', '-fdq', 'data', 'images');
}

async function gh(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function openRequests() {
  const list = await gh(`/repos/${REPO}/issues?state=open&creator=${encodeURIComponent(OWNER)}&sort=created&direction=asc&per_page=50`);
  return list.filter((i) => !i.pull_request && String(i.body || '').includes(MARKER));
}

function parseRequest(body) {
  const m = /```json\s*([\s\S]*?)```/.exec(body || '');
  if (!m) throw new Error('The request had no details in it.');
  const raw = JSON.parse(m[1]);
  if (!TYPES.includes(raw.type)) throw new Error(`Unknown request type "${raw.type}".`);
  const rating = raw.rating == null ? null : Math.round(Number(raw.rating) * 10) / 10;
  if (rating != null && !(rating >= 0 && rating <= 10)) throw new Error('The rating has to be between 0 and 10.');
  return {
    type: raw.type,
    id: raw.id ? slug(raw.id) : '',
    name: clip(raw.name, 80),
    rating,
    mustGo: !!raw.mustGo,
    order: clip(raw.order, 80),
    comments: (Array.isArray(raw.comments) ? raw.comments : []).map((c) => clip(c, 400)).filter(Boolean).slice(0, 12),
    tier: ['quick', 'sitdown'].includes(raw.tier) ? raw.tier : '',
    where: clip(raw.where, 120),
    note: clip(raw.note, 400),
  };
}

/* ---------- Haiku: tidy comments, pick tags and price ---------- */

const client = HAS_KEY ? new Anthropic() : null;

const TIDY_SCHEMA = {
  type: 'object',
  properties: {
    comments: { type: 'array', items: { type: 'string' } },
    mustTry: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    price: { type: 'string', enum: ['$', '$$', '$$$', '$$$$'] },
  },
  required: ['comments', 'mustTry', 'tags', 'price'],
  additionalProperties: false,
};

const TIDY_SYSTEM = `You tidy up restaurant reviews for a small personal food guide two friends keep for Auburn and Opelika, Alabama.
Return JSON only.
- comments: the reviewer's own comments, one thought per item, in the same order. Fix spelling, capitalization and punctuation, end each with a period, and split run-ons into separate items when they are clearly separate thoughts. Keep their words, tone and slang. Do not add opinions, details or praise they didn't write. Never use em dashes; use a plain hyphen or rephrase.
- mustTry: the dish from "Order this", cleaned up the same way (title case for dish names). Empty if none was given.
- tags: 2 or 3 short facts worth scanning for (1-3 words each, title case), drawn from the place details and comments, e.g. "Late Night", "Drive-Thru", "Patio", "Lunch Buffet", "BYOB". No opinions, no ratings, no emoji. If existing tags are given, return them unchanged.
- price: typical cost per person. $ under $12, $$ $12-25, $$$ $25-50, $$$$ over $50. If a price is given, return it unchanged.`;

async function tidy({ place, comments, order, keepTags, keepPrice }) {
  const fallback = {
    comments: comments.map((c) => { const t = c.charAt(0).toUpperCase() + c.slice(1); return /[.!?]$/.test(t) ? t : `${t}.`; }),
    mustTry: order ? [order] : [],
    tags: keepTags || [],
    price: keepPrice || (place.tier === 'sitdown' ? '$$' : '$'),
    cost: 0,
  };
  if (!client) return fallback;
  const facts = {
    name: place.name, category: place.category, tier: place.tier, area: place.area,
    hours: place.hours, blurb: place.blurb, existingTags: keepTags, existingPrice: keepPrice,
  };
  try {
    const res = await client.messages.create({
      model: HAIKU,
      max_tokens: 2000,
      system: TIDY_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TIDY_SCHEMA } },
      messages: [{
        role: 'user',
        content: `Place details:\n${JSON.stringify(facts, null, 2)}\n\nOrder this: ${order || '(none)'}\n\nComments:\n${comments.map((c) => `- ${c}`).join('\n')}`,
      }],
    });
    const cost = (res.usage.input_tokens * 0.10 + res.usage.output_tokens * 0.50) / 1e6;
    if (res.stop_reason !== 'end_turn') { console.warn(`Haiku stopped with ${res.stop_reason}, using the comments as sent`); return { ...fallback, cost }; }
    const text = res.content.find((b) => b.type === 'text')?.text || '';
    const out = JSON.parse(text);
    return {
      comments: (out.comments.length ? out.comments : fallback.comments).map(noDash),
      mustTry: order ? out.mustTry.map(noDash).slice(0, 3) : [],
      tags: keepTags || out.tags.map(noDash).slice(0, 3),
      price: keepPrice || out.price,
      cost,
    };
  } catch (err) {
    console.warn(`Haiku tidy failed, using the comments as sent: ${err.message}`);
    return fallback;
  }
}

// Field order matches the hand-written entries in places.json.
const ORDER = ['id', 'name', 'category', 'price', 'tier', 'rating', 'verdict', 'comments', 'mustTry', 'tags', 'added', 'visited', 'blurb', 'address', 'area', 'lat', 'lng', 'phone', 'website', 'hours', 'photos', 'photoCredit'];
function ordered(p) {
  const out = {};
  for (const k of ORDER) if (p[k] !== undefined) out[k] = p[k];
  for (const k of Object.keys(p)) if (!(k in out)) out[k] = p[k];
  return out;
}

async function rateWish(req) {
  const places = readJson(PLACES);
  const wish = readJson(WISH);
  const i = wish.spots.findIndex((w) => w.id === req.id);
  if (i < 0) throw new Error(`"${req.name || req.id}" isn't on the To Try list anymore.`);
  const w = wish.spots[i];
  if (!req.comments.length) throw new Error('The rating had no comments.');
  const t = await tidy({ place: w, comments: req.comments, order: req.order });
  const place = ordered({
    ...w,
    price: t.price,
    rating: req.rating,
    verdict: req.mustGo ? 'Must-go' : undefined,
    comments: t.comments,
    mustTry: t.mustTry,
    tags: t.tags,
    added: nowLocal(),
  });
  places.places.push(place);
  wish.spots.splice(i, 1);
  writeJson(PLACES, places);
  writeJson(WISH, wish);
  return {
    id: place.id, list: 'places', model: HAIKU, cost: t.cost,
    title: `Add ${place.name} (${req.rating.toFixed(1)}/10)`,
    summary: `Moved ${place.name} from To Try to the Guide at ${req.rating.toFixed(1)}/10${req.mustGo ? ' (Must-go)' : ''}.`,
  };
}

async function rerate(req) {
  const places = readJson(PLACES);
  const p = places.places.find((x) => x.id === req.id);
  if (!p) throw new Error(`"${req.name || req.id}" isn't in the guide.`);
  let cost = 0;
  if (req.comments.length) {
    const t = await tidy({ place: p, comments: req.comments, order: req.order, keepTags: p.tags, keepPrice: p.price });
    p.comments = t.comments;
    p.mustTry = t.mustTry;
    cost = t.cost;
  } else {
    p.mustTry = req.order ? [req.order] : [];
  }
  const was = p.rating;
  p.rating = req.rating;
  if (req.mustGo) p.verdict = 'Must-go';
  else if (p.verdict === 'Must-go') delete p.verdict;
  places.places[places.places.indexOf(p)] = ordered(p);
  writeJson(PLACES, places);
  return {
    id: p.id, list: 'places', model: HAIKU, cost,
    title: `Update ${p.name} (${req.rating.toFixed(1)}/10)`,
    summary: `Updated ${p.name}: ${Number(was).toFixed(1)} -> ${req.rating.toFixed(1)}/10${req.mustGo ? ' (Must-go)' : ''}.`,
  };
}

/* ---------- Sonnet: research a new place with the Agent SDK ---------- */

function researchPrompt(req, scratch) {
  const rate = req.type === 'ratenew';
  const lines = [
    'A request came in from the Grub Guide app. Follow CLAUDE.md in this repository.',
    '',
    `Place: ${req.name}`,
    `Where: ${req.where || 'not given (somewhere around Auburn or Opelika, AL)'}`,
    `Tier: ${req.tier ? `${req.tier} (Bruce picked this)` : 'not given, decide from the research'}`,
    req.note ? `Note from Bruce: ${req.note}` : null,
  ];
  if (rate) {
    lines.push(
      `Rating: ${req.rating.toFixed(1)}/10${req.mustGo ? ' (Must-go)' : ''}`,
      req.order ? `Order this: ${req.order}` : null,
      'Comments:',
      ...req.comments.map((c) => `- ${c}`),
      '',
      'Job: research the place and add it to data/places.json as a rated spot, following "Adding a spot" in CLAUDE.md.',
      `Set verdict "Must-go" only if marked above. mustTry only from "Order this". Comments are Bruce's words, lightly cleaned up, one thought per item.`,
    );
  } else {
    lines.push('', 'Job: research the place and add it to data/wishlist.json (the To Try list), following "To Try list" in CLAUDE.md, with 3-5 photos.');
  }
  lines.push(
    '',
    'Rules for this run:',
    '- You are running unattended in GitHub Actions. Nobody can answer questions, so make the call yourself.',
    '- Do not commit, push or touch git. The workflow publishes your changes after you finish.',
    `- Only change data/places.json, data/wishlist.json and images/places/<id>/. Download and sort photos in ${scratch} (outside the repo).`,
    '- Look at candidate photos before using them: build a contact sheet with Pillow and open it with the Read tool.',
    `- If the place is already in data/places.json${rate ? '' : ' or data/wishlist.json'}, change nothing and reply with "ALREADY: " and one sentence.`,
    '- If you cannot identify one real place that matches, change nothing and reply with "NOT FOUND: " and one sentence saying what was unclear.',
    '- Skip the screenshot step. Run node scripts/validate.mjs at the end. It must pass.',
    '- Finish with one plain sentence: what you added, its address, and how many photos.',
  );
  return lines.filter((l) => l != null).join('\n');
}

async function research(req) {
  if (!HAS_KEY) throw new Error('The ANTHROPIC_API_KEY secret is not set up yet, so new places cannot be researched.');
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  const scratch = join(process.env.RUNNER_TEMP || tmpdir(), `grub-${Date.now()}`);
  mkdirSync(scratch, { recursive: true });
  const before = { places: readJson(PLACES).places.map((p) => p.id), wish: readJson(WISH).spots.map((w) => w.id) };

  const tools = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
  let result;
  for await (const msg of query({
    prompt: researchPrompt(req, scratch),
    options: {
      model: SONNET,
      cwd: ROOT,
      settingSources: ['project'],
      tools,
      allowedTools: tools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 80,
      maxBudgetUsd: SONNET_BUDGET_USD,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: 'You are the Grub Guide research bot. Bruce is the person who sent the request.' },
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'auburn-grub-guide/1.0' },
    },
  })) {
    if (msg.type === 'assistant') {
      for (const b of msg.message.content || []) {
        if (b.type === 'tool_use') console.log(`  > ${b.name} ${JSON.stringify(b.input).slice(0, 160)}`);
      }
    } else if (msg.type === 'result') {
      result = msg;
    }
  }
  rmSync(scratch, { recursive: true, force: true });
  if (!result) throw new Error('The research run ended without a result.');
  const cost = result.total_cost_usd || 0;
  console.log(`Sonnet finished: ${result.subtype}, ${result.num_turns} turns, $${cost.toFixed(3)}`);
  if (result.subtype !== 'success') {
    const why = { error_max_budget_usd: `it hit the $${SONNET_BUDGET_USD} limit`, error_max_turns: 'it ran out of steps' }[result.subtype] || 'it ran into an error';
    throw Object.assign(new Error(`Research stopped because ${why}.`), { cost });
  }
  const text = String(result.result || '').trim();
  if (/^(ALREADY|NOT FOUND):/i.test(text)) throw Object.assign(new Error(text.replace(/^(ALREADY|NOT FOUND):\s*/i, '')), { cost });

  const list = req.type === 'ratenew' ? 'places' : 'wish';
  const now = list === 'places' ? readJson(PLACES).places : readJson(WISH).spots;
  const added = now.find((p) => !before[list].includes(p.id));
  if (!added) throw Object.assign(new Error(`Nothing new showed up on the ${list === 'places' ? 'Guide' : 'To Try list'}.`), { cost });
  return {
    id: added.id, list, model: SONNET, cost,
    title: list === 'places' ? `Add ${added.name} (${Number(added.rating).toFixed(1)}/10)` : `Add ${added.name} to the To Try list`,
    summary: text.split('\n').filter(Boolean).pop() || `Added ${added.name}.`,
  };
}

/* ---------- routing and publishing ---------- */

// The app routes by id, but a typed name can still match a spot we already have.
function route(req) {
  const places = readJson(PLACES).places;
  const wish = readJson(WISH).spots;
  if (req.type === 'add' || req.type === 'ratenew') {
    const rated = places.find((p) => norm(p.name) === norm(req.name));
    const listed = wish.find((w) => norm(w.name) === norm(req.name));
    if (req.type === 'add' && rated) throw new Error(`${rated.name} is already in the guide.`);
    if (req.type === 'add' && listed) throw new Error(`${listed.name} is already on the To Try list.`);
    if (req.type === 'ratenew' && listed) return { ...req, type: 'rate', id: listed.id };
    if (req.type === 'ratenew' && rated) return { ...req, type: 'rerate', id: rated.id };
  }
  if ((req.type === 'rate' || req.type === 'rerate') && req.rating == null) throw new Error('The request had no rating.');
  if (req.type === 'ratenew' && (req.rating == null || !req.comments.length)) throw new Error('The rating needs a score and a comment.');
  if (!req.name && !req.id) throw new Error('The request had no place name.');
  return req;
}

function publish(title) {
  execFileSync('node', ['scripts/validate.mjs'], { cwd: ROOT, stdio: 'inherit' });
  git('add', '-A', 'data', 'images');
  if (!git('diff', '--cached', '--name-only')) throw new Error('No changes were made.');
  git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '--quiet', '-m', `${title}\n\nSent from the app.`);
  for (let i = 0; ; i++) {
    try { git('push', '--quiet', 'origin', 'HEAD:main'); return; } catch (err) {
      if (i >= 3) throw err;
      git('pull', '--quiet', '--rebase', 'origin', 'main');
    }
  }
}

const money = (n) => (n < 0.01 ? 'under 1 cent' : `about $${n.toFixed(2)}`);
const modelName = (m) => (m === HAIKU ? 'Claude Haiku' : 'Claude Sonnet');
const resultTag = (obj) => `<!-- grub-guide-result ${JSON.stringify(obj)} -->`;

async function handle(issue) {
  console.log(`\n#${issue.number} ${issue.title}`);
  resetToMain();
  let req;
  try {
    req = route(parseRequest(issue.body));
    const job = { rate: rateWish, rerate, add: research, ratenew: research }[req.type];
    const r = await job(req);
    publish(r.title);
    await gh(`/repos/${REPO}/pages/builds`, { method: 'POST' }).catch((err) => console.warn(`Pages build request failed: ${err.message}`));
    await gh(`/repos/${REPO}/issues/${issue.number}/comments`, {
      method: 'POST',
      body: { body: `${r.summary}\n\n${HAS_KEY ? `Done by ${modelName(r.model)}, ${money(r.cost)}.` : 'Done without Claude (the ANTHROPIC_API_KEY secret is not set), so the comments went in as sent.'} The site updates in a minute or two.\n\n${resultTag({ ok: true, id: r.id, list: r.list, model: r.model, cost: r.cost })}` },
    });
    await gh(`/repos/${REPO}/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
    console.log(r.summary);
  } catch (err) {
    console.error(err);
    try { resetToMain(); } catch (_) { /* best effort */ }
    const message = String(err.message || err).split('\n')[0].slice(0, 300);
    await gh(`/repos/${REPO}/issues/${issue.number}/comments`, {
      method: 'POST',
      body: { body: `This one didn't go through: ${message}\n\nNothing was changed.${err.cost ? ` (Used ${money(err.cost)}.)` : ''}\n\n${resultTag({ ok: false, message, cost: err.cost || 0 })}` },
    });
    await gh(`/repos/${REPO}/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'not_planned' } });
  }
}

async function main() {
  if (!REPO || !GH_TOKEN) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN must be set (this runs in GitHub Actions).');
  if (!existsSync(PLACES)) throw new Error('Run from the repository checkout.');
  const seen = new Set();
  for (;;) {
    const next = (await openRequests()).find((i) => !seen.has(i.number));
    if (!next) break;
    seen.add(next.number);
    await handle(next);
  }
  if (!seen.size) console.log('No open requests.');
}

main().catch((err) => { console.error(err); process.exit(1); });

#!/usr/bin/env node
// Checks data/places.json before it ships. Usage: node scripts/validate.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

let data;
try {
  data = JSON.parse(readFileSync(join(root, 'data/places.json'), 'utf8'));
} catch (err) {
  console.error(`data/places.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const places = data.places;
if (!Array.isArray(places)) {
  console.error('data/places.json must look like { "places": [ ... ] }');
  process.exit(1);
}

const ids = new Set();
for (const [i, p] of places.entries()) {
  const at = `places[${i}] (${p.name || 'no name'})`;
  if (!p.name) errors.push(`${at}: missing "name"`);
  if (!p.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errors.push(`${at}: "id" must be a lowercase slug like "flying-biscuit"`);
  if (ids.has(p.id)) errors.push(`${at}: duplicate id "${p.id}"`);
  ids.add(p.id);
  if (typeof p.rating !== 'number' || p.rating < 0 || p.rating > 10) errors.push(`${at}: "rating" must be a number from 0 to 10`);
  if (p.verdict && !['Perfect', 'Must-go', 'Great', 'Good', 'Solid', 'Meh', 'Skip it'].includes(p.verdict)) errors.push(`${at}: "verdict" must be Perfect, Must-go, Great, Good, Solid, Meh or Skip it`);
  if (!p.category) warnings.push(`${at}: no "category"`);
  if (!Array.isArray(p.comments) || !p.comments.length) warnings.push(`${at}: no "comments"`);
  if (p.added && Number.isNaN(Date.parse(p.added))) errors.push(`${at}: "added" is not a date`);
  if (p.visited && !/^\d{4}-\d{2}-\d{2}$/.test(p.visited)) errors.push(`${at}: "visited" must be YYYY-MM-DD`);
  if ((p.lat != null || p.lng != null) && !(Number.isFinite(p.lat) && Number.isFinite(p.lng))) errors.push(`${at}: "lat" and "lng" must both be numbers`);
  if (p.lat == null) warnings.push(`${at}: no coordinates, it won't show on the map`);
  if (p.website && !/^https?:\/\//.test(p.website)) errors.push(`${at}: "website" must start with http(s)://`);
  for (const src of p.photos || []) {
    if (!existsSync(join(root, src))) errors.push(`${at}: photo not found: ${src}`);
  }
  if (!p.photos || !p.photos.length) warnings.push(`${at}: no photos`);
}

// To Try list
let wish = [];
try {
  wish = JSON.parse(readFileSync(join(root, 'data/wishlist.json'), 'utf8')).spots || [];
} catch (err) {
  errors.push(`data/wishlist.json is not valid JSON: ${err.message}`);
}
const norm = (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, '');
const ratedNames = new Set(places.map((p) => norm(p.name)));
const wishIds = new Set();
for (const [i, w] of wish.entries()) {
  const at = `wishlist[${i}] (${w.name || 'no name'})`;
  if (!w.name) errors.push(`${at}: missing "name"`);
  if (!w.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(w.id)) errors.push(`${at}: "id" must be a lowercase slug`);
  if (wishIds.has(w.id)) errors.push(`${at}: duplicate id "${w.id}"`);
  wishIds.add(w.id);
  if (!['quick', 'sitdown'].includes(w.tier)) errors.push(`${at}: "tier" must be "quick" or "sitdown"`);
  if (ids.has(w.id) || ratedNames.has(norm(w.name))) errors.push(`${at}: already rated in places.json, remove it from the wishlist`);
  for (const src of w.photos || []) {
    if (!existsSync(join(root, src))) errors.push(`${at}: photo not found: ${src}`);
  }
  if (!w.photos || !w.photos.length) warnings.push(`${at}: no photos`);
  if (w.website && !/^https?:\/\//.test(w.website)) errors.push(`${at}: "website" must start with http(s)://`);
}
for (const [i, p] of places.entries()) {
  if (p.tier && !['quick', 'sitdown'].includes(p.tier)) errors.push(`places[${i}] (${p.name}): "tier" must be "quick" or "sitdown"`);
  if (!p.tier) warnings.push(`places[${i}] (${p.name}): no "tier" (quick or sitdown) for the spinner`);
}

warnings.forEach((w) => console.warn(`warn  ${w}`));
errors.forEach((e) => console.error(`error ${e}`));
console.log(`${places.length} places and ${wish.length} to-try spots checked, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);

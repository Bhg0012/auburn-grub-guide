#!/usr/bin/env node
// Stamps index.html with a hash of app.js and styles.css (assets/app.js?v=...), so a
// browser never pairs a fresh page with stale cached code. Run after editing either.
// Usage: node scripts/stamp.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const hash = (f) => createHash('sha1').update(readFileSync(join(root, f))).digest('hex').slice(0, 10);

let out = html;
for (const f of ['assets/app.js', 'assets/styles.css']) {
  const re = new RegExp(`${f.replace('.', '\\.')}(\\?v=[0-9a-f]*)?"`, 'g');
  out = out.replace(re, `${f}?v=${hash(f)}"`);
}

if (process.argv.includes('--check')) {
  if (out !== html) { console.error('index.html asset versions are stale. Run: node scripts/stamp.mjs'); process.exit(1); }
  console.log('index.html asset versions are current');
} else if (out !== html) {
  writeFileSync(htmlPath, out);
  console.log('index.html stamped');
} else {
  console.log('index.html already current');
}

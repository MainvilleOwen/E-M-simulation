// Static link check: every local href/src/import resolves to a file, every hash route is known.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_ROUTES, HIDDEN_ROUTES } from '../js/ui/route.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const seen = new Set();
const knownTops = new Set(['', ...MODULE_ROUTES, ...HIDDEN_ROUTES]);

function rel(p) { return relative(root, p) || '.'; }

function checkLocalRef(fromFile, ref) {
  if (!ref || /^(https?:|data:|mailto:|javascript:|#)/.test(ref)) {
    if (/^https?:/.test(ref)) errors.push(`${rel(fromFile)}: external reference not allowed: ${ref}`);
    return null;
  }
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  const target = resolve(dirname(fromFile), clean);
  if (!existsSync(target)) {
    errors.push(`${rel(fromFile)}: missing ${ref}`);
    return null;
  }
  return target;
}

function checkHashRoutes(file, text) {
  const re = /#\/([a-z0-9-]*)/gi;
  let m;
  while ((m = re.exec(text))) {
    const top = m[1];
    if (!knownTops.has(top)) errors.push(`${rel(file)}: unknown hash route #/${top}`);
  }
}

function walkJs(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const importRe = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = importRe.exec(text))) {
    const spec = m[1] || m[2];
    if (!spec.startsWith('.')) {
      errors.push(`${rel(file)}: bare or remote import not allowed in the browser: ${spec}`);
      continue;
    }
    const target = checkLocalRef(file, spec);
    if (target && target.endsWith('.js')) walkJs(target);
  }
  checkHashRoutes(file, text);
  if (/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket/.test(text)) {
    errors.push(`${rel(file)}: network call found (not allowed)`);
  }
}

// 1. index.html
const indexPath = join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8');
const attrRe = /\s(?:href|src)="([^"]+)"/g;
let m;
while ((m = attrRe.exec(html))) {
  const target = checkLocalRef(indexPath, m[1]);
  if (target && target.endsWith('.js')) walkJs(target);
}
checkHashRoutes(indexPath, html);

// 2. CSS url() references
function walkDir(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
for (const css of walkDir(join(root, 'css'), '.css')) {
  const text = readFileSync(css, 'utf8');
  const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  while ((m = urlRe.exec(text))) checkLocalRef(css, m[1]);
}

// 3. Every JS file in js/ must be reachable or at least parse-checked for imports.
for (const js of walkDir(join(root, 'js'), '.js')) walkJs(js);

if (errors.length) {
  console.error(`Link check failed (${errors.length}):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`Link check passed: ${seen.size} JS files, index.html and CSS references resolve.`);

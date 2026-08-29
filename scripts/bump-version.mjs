#!/usr/bin/env node
/**
 * bump-version.mjs — bump the plugin version across every declared manifest,
 * with drift detection and a repo-wide audit for missed version strings.
 *
 * Usage (from the repository root):
 *   node scripts/bump-version.mjs <new-version>   bump all declared files to <new-version>
 *   node scripts/bump-version.mjs --check         report current versions, detect drift
 *   node scripts/bump-version.mjs --audit         check + scan the repo for undeclared version refs
 *
 * The set of version-bearing files lives in .version-bump.json:
 *   { "version": "0.5.3", "files": { "<path>": "<field>" } }
 * Dotted fields like "plugins[0].version" are supported. package-lock.json is
 * special-cased: every "version" key is updated (root and packages[""]).
 * DSH-COMPATIBILITY.md's "Package under test" row is kept in sync on bump.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, '.version-bump.json');
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) fail(`.version-bump.json not found at ${CONFIG_PATH}`);
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function declared(config) {
  return Object.entries(config.files || {}).map(([p, f]) => ({ path: path.normalize(p), field: f }));
}

// resolve "a.b", "a[0].b", 'a["b"].c' against a parsed JSON value
function resolve(obj, field) {
  const parts = field
    .replace(/\["([^"]+)\"\]/g, '.$1')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function readVersion(relPath, field) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return { ok: false, reason: 'MISSING' };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { return { ok: false, reason: 'invalid JSON' }; }
  const v = resolve(parsed, field);
  if (typeof v !== 'string' || !v) return { ok: false, reason: `field '${field}' not found` };
  return { ok: true, version: v };
}

function writeVersion(relPath, oldVersion, newVersion) {
  const full = path.join(ROOT, relPath);
  const text = fs.readFileSync(full, 'utf8');
  const needle = `"version": "${oldVersion}"`;
  if (!text.includes(needle)) return { ok: false, reason: `no "${oldVersion}" version field found` };
  const count = text.split(needle).length - 1;
  fs.writeFileSync(full, text.split(needle).join(`"version": "${newVersion}"`));
  return { ok: true, count };
}

function syncCompatibilityDoc(oldVersion, newVersion) {
  const full = path.join(ROOT, 'DSH-COMPATIBILITY.md');
  if (!fs.existsSync(full)) return;
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  let changed = 0;
  const out = lines.map((line) => {
    if (!line.includes('Package under test')) return line;
    const m = line.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
    if (!m || m[1] !== oldVersion) return line;
    changed++;
    return line.replace(m[1], newVersion);
  });
  if (changed) fs.writeFileSync(full, out.join('\n'));
}

function cmdCheck(config) {
  const rows = declared(config);
  const versions = new Set();
  let bad = false;
  console.log('Version check:');
  for (const { path: p, field } of rows) {
    const r = readVersion(p, field);
    if (!r.ok) { console.log(`  ${p} (${field})  ${r.reason}`); bad = true; continue; }
    versions.add(r.version);
    console.log(`  ${p} (${field})  ${r.version}`);
  }
  if (bad) return 1;
  if (versions.size > 1) {
    console.error(`DRIFT: declared versions differ: ${[...versions].join(', ')}`);
    return 1;
  }
  const [v] = [...versions];
  console.log(`\nAll declared files are in sync at ${v}`);
  return 0;
}

function walk(dir, rel, skipDirs, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || skipDirs.has(relPath)) continue;
      walk(path.join(dir, entry.name), relPath, skipDirs, out);
    } else if (entry.isFile()) {
      out.push({ abs: path.join(dir, entry.name), rel: relPath });
    }
  }
}

function cmdAudit(config) {
  const checkCode = cmdCheck(config);
  console.log('');
  const declaredPaths = new Set(declared(config).map((d) => d.path));
  const current = config.version;
  const excludes = config.audit?.exclude || [];
  const skipDirs = new Set(['.git', 'node_modules']);
  const exclNames = new Set(excludes.map((e) => path.basename(e)));
  const exclPaths = new Set(excludes.map((e) => path.normalize(e)));

  const files = [];
  walk(ROOT, '', skipDirs, files);
  const hits = [];
  for (const { abs, rel } of files) {
    const norm = path.normalize(rel);
    if (declaredPaths.has(norm)) continue;
    if (exclPaths.has(norm) || exclNames.has(path.basename(norm))) continue;
    let stat;
    try { stat = fs.statSync(abs); } catch { continue; }
    if (stat.size > 2 * 1024 * 1024) continue;
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    if (text.includes(current)) hits.push(rel);
  }
  if (hits.length) {
    console.error(`UNDECLARED files containing '${current}':`);
    for (const h of hits) console.error(`  ${h}`);
    console.error('\nReview them — bump them or add them to .version-bump.json audit.exclude.');
    return 1;
  }
  console.log(`No undeclared files contain '${current}'. All clear.`);
  return checkCode;
}

function cmdBump(config, newVersion) {
  if (!VERSION_RE.test(newVersion)) fail(`'${newVersion}' is not a valid X.Y.Z version`);
  const rows = declared(config);
  const oldVersion = config.version;
  if (!oldVersion) fail('current version not set in .version-bump.json');
  console.log(`Bumping all declared files from ${oldVersion} to ${newVersion}...\n`);
  let failures = 0;
  for (const { path: p, field } of rows) {
    const r = readVersion(p, field);
    if (!r.ok) { console.log(`  SKIP (${r.reason}): ${p}`); continue; }
    const w = writeVersion(p, oldVersion, newVersion);
    if (!w.ok) { console.log(`  FAIL: ${p} — ${w.reason}`); failures++; continue; }
    console.log(`  ${p}  ${r.version} -> ${newVersion} (${w.count} field${w.count > 1 ? 's' : ''})`);
  }
  syncCompatibilityDoc(oldVersion, newVersion);
  if (failures) fail(`${failures} file(s) failed to update`);
  console.log('\nDone. Running audit...\n');
  process.exitCode = cmdAudit({ ...config, version: newVersion });
}

const [arg] = process.argv.slice(2);
if (!arg || arg === '--help' || arg === '-h') {
  console.log(`Usage:
  node scripts/bump-version.mjs <new-version>   bump all declared files to the given version
  node scripts/bump-version.mjs --check         show current versions, detect drift
  node scripts/bump-version.mjs --audit         check + scan repo for undeclared version refs`);
  process.exitCode = arg ? 0 : 1;
} else if (arg === '--check') {
  process.exitCode = cmdCheck(loadConfig());
} else if (arg === '--audit') {
  process.exitCode = cmdAudit(loadConfig());
} else if (arg.startsWith('--')) {
  fail(`unknown flag '${arg}'`);
} else {
  cmdBump(loadConfig(), arg);
}

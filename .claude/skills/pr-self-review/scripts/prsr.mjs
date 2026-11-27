#!/usr/bin/env node
// pr-self-review engine. Zero dependencies (Node >= 22). Subcommands:
//   collect [--quick] [--no-cache]   snapshot the branch diff, route files to skills, resolve cache → run.json
//   checks                           run deterministic checks for touched packages → checks.json
//   finalize <results.json>          merge skill findings + checks, suppressions, verdict → verdict/report/pr-body
//   gate [--pre-push]                exit 1 unless the commit(s) being pushed match a PASS verdict
//   hook                             Claude Code PreToolUse hook (stdin JSON); exit 2 blocks the Bash call
//   status                           print the current verdict
// State lives in <repo>/.devdigest/pr-self-review/ (gitignored).

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_ROOT = path.dirname(SKILL_DIR);
const ROUTING = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'routing.json'), 'utf8'));
const SEVERITIES = ['critical', 'major', 'minor'];
const ZERO_SHA = '0000000000000000000000000000000000000000';
const MAIN_BRANCHES = new Set(['main', 'master']);
const CODE_EXT = /\.(?:[cm]?[jt]sx?|json|sql|ya?ml|sh)$/;

// ---------- helpers ----------------------------------------------------------
const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
const tryGit = (args, opts) => { try { return git(args, opts).trim(); } catch { return null; } };

const ROOT = tryGit(['rev-parse', '--show-toplevel']);
if (!ROOT) { console.error('pr-self-review: not inside a git repository'); process.exit(1); }
const STATE = path.join(ROOT, '.devdigest', 'pr-self-review');
const P = {
  run: path.join(STATE, 'run.json'),
  checks: path.join(STATE, 'checks.json'),
  verdict: path.join(STATE, 'verdict.json'),
  report: path.join(STATE, 'report.md'),
  body: path.join(STATE, 'pr-body.md'),
  cache: path.join(STATE, 'cache'),
  ignore: path.join(ROOT, '.pr-self-review-ignore.json'),
};

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Minimal glob → RegExp: `**` (any depth, incl. dot-dirs), `*`, `?`, `{a,b}`. Paths are repo-relative, `/`-separated. */
const globCache = new Map();
function globRe(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') { const end = glob.indexOf('}', i); re += `(?:${glob.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`; i = end; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  const out = new RegExp(`^${re}$`);
  globCache.set(glob, out);
  return out;
}
const matchGlob = (file, glob) => globRe(glob).test(file);
const anyGlob = (file, globs = []) => globs.some((g) => matchGlob(file, g));
const die = (msg, code = 1) => { console.error(`pr-self-review: ${msg}`); process.exit(code); };

function isExcluded(file) {
  return anyGlob(file, ROUTING.exclude) && !anyGlob(file, ROUTING.excludeExceptions);
}

function resolveBase(target = 'HEAD') {
  for (const ref of ['origin/main', 'main', 'origin/master', 'master']) {
    if (!tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) continue;
    const mb = tryGit(['merge-base', ref, target]);
    if (mb) return { base: mb, baseRef: ref };
  }
  die('cannot find a merge-base with main/master');
}

/** Tree SHA of the working tree (tracked + untracked, minus ignored) without touching the real index. */
function worktreeTree() {
  const gitDir = git(['rev-parse', '--absolute-git-dir']).trim();
  const tmp = path.join(os.tmpdir(), `prsr-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  try {
    const realIndex = path.join(gitDir, 'index');
    if (fs.existsSync(realIndex)) fs.copyFileSync(realIndex, tmp);
    else git(['read-tree', 'HEAD'], { env, cwd: ROOT });
    git(['add', '-A'], { env, cwd: ROOT });
    return git(['write-tree'], { env, cwd: ROOT }).trim();
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** path → blob sha (null = deleted) for every path that differs between two tree-ish. */
function changedMap(from, to) {
  const out = git(['diff-tree', '-r', '-z', '--no-renames', '--no-abbrev', from, to]);
  const parts = out.split('\0');
  const map = {};
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i].replace(/^:/, '').split(' '); // srcMode dstMode srcSha dstSha status
    const file = parts[i + 1];
    if (!file || meta.length < 5) continue;
    map[file] = meta[4] === 'D' || meta[3] === ZERO_SHA ? null : meta[3];
  }
  return map;
}

function numstat(from, to) {
  const out = git(['diff', '--numstat', '-z', '--no-renames', from, to]);
  const stats = {};
  for (const rec of out.split('\0')) {
    const m = rec.match(/^(\S+)\t(\S+)\t(.+)$/);
    if (!m) continue;
    stats[m[3]] = m[1] === '-' ? { binary: true, added: 0, deleted: 0 } : { added: +m[1], deleted: +m[2] };
  }
  return stats;
}

function hashDir(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) h.update(path.relative(dir, p)).update('\0').update(fs.readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}

const rubricHash = () =>
  sha256(['references/severity-rubric.md', 'references/finding-schema.md']
    .map((f) => fs.readFileSync(path.join(SKILL_DIR, f), 'utf8')).join('\0'));

function availableSkills() {
  return fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS_ROOT, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

function blobContent(blob) {
  try { return git(['cat-file', 'blob', blob]); } catch { return ''; }
}

// ---------- collect -----------------------------------------------------------
function collect(args) {
  const quick = args.includes('--quick');
  const useCache = !args.includes('--no-cache');
  const { base, baseRef } = resolveBase();
  const tree = worktreeTree();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const head = git(['rev-parse', 'HEAD']).trim();
  const snapshot = changedMap(base, tree);
  const stats = numstat(base, tree);

  const skillsOnDisk = new Set(availableSkills());
  const routed = new Set(ROUTING.rules.flatMap((r) => r.skills).concat(ROUTING.contentRules.flatMap((r) => r.skills)));
  const unmappedSkills = [...skillsOnDisk].filter((s) => !routed.has(s) && !ROUTING.notReviewSkills.includes(s));
  const missingSkills = [...routed].filter((s) => !skillsOnDisk.has(s));

  const warnings = [];
  const files = [];
  const excluded = [];
  const unrouted = [];
  const deleted = [];
  const skillFiles = {};
  let reviewableLines = 0;

  for (const [file, blob] of Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b))) {
    const st = stats[file] ?? { added: 0, deleted: 0 };
    if (blob === null) { deleted.push(file); continue; }
    if (isExcluded(file)) { excluded.push(file); continue; }
    if (st.binary) {
      if (!CODE_EXT.test(file)) { excluded.push(file); continue; }
      const text = blobContent(blob);
      st.added = text.split('\n').length;
      warnings.push(`git treats ${file} as binary (it contains a NUL or other control byte, e.g. a raw \\0 inside a string literal); reviewing it anyway — prefer an escape sequence.`);
    }
    reviewableLines += st.added + st.deleted;
    const skills = new Set();
    for (const r of ROUTING.rules) {
      if (anyGlob(file, r.glob) && !anyGlob(file, r.unless)) r.skills.forEach((s) => skills.add(s));
    }
    const content = ROUTING.contentRules.some((r) => anyGlob(file, r.glob)) ? blobContent(blob) : '';
    for (const r of ROUTING.contentRules) {
      if (anyGlob(file, r.glob) && new RegExp(r.pattern).test(content)) r.skills.forEach((s) => skills.add(s));
    }
    let list = [...skills].filter((s) => skillsOnDisk.has(s));
    if (quick) list = list.filter((s) => ROUTING.quickSkills.includes(s));
    files.push({ path: file, blob, added: st.added, deleted: st.deleted, skills: list });
    if (list.length === 0) unrouted.push(file);
    for (const s of list) (skillFiles[s] ??= []).push(file);
  }

  // packages touched → deterministic checks
  const pkgs = new Set();
  const touched = [...files.map((f) => f.path), ...deleted];
  for (const [name, pkg] of Object.entries(ROUTING.packages)) {
    if (touched.some((f) => f.startsWith(pkg.prefix))) {
      pkgs.add(name);
      (pkg.alsoAffects ?? []).forEach((p) => pkgs.add(p));
    }
  }
  const checks = [];
  for (const name of [...pkgs].sort()) {
    for (const cmd of ROUTING.packages[name].checks) checks.push({ id: `${name}: ${cmd}`, pkg: name, cwd: name, cmd });
  }
  if (touched.some((f) => anyGlob(f, ROUTING.sharedParity.glob))) {
    checks.push({ id: 'shared: check-shared.sh', pkg: null, cwd: '.', cmd: ROUTING.sharedParity.check });
  }

  // cache resolution
  const rHash = rubricHash();
  const skills = {};
  for (const [skill, list] of Object.entries(skillFiles)) {
    const sHash = hashDir(path.join(SKILLS_ROOT, skill));
    const cacheDir = path.join(P.cache, skill, `${sHash.slice(0, 12)}-${rHash.slice(0, 12)}`);
    const cached = {};
    const toReview = [];
    for (const f of list) {
      const blob = snapshot[f];
      const cf = path.join(cacheDir, `${blob}.json`);
      if (useCache && fs.existsSync(cf)) cached[f] = readJson(cf).findings;
      else toReview.push(f);
    }
    skills[skill] = {
      skillMd: path.relative(ROOT, path.join(SKILLS_ROOT, skill, 'SKILL.md')),
      cacheDir: path.relative(ROOT, cacheDir),
      files: list, toReview, cached,
    };
  }

  if (reviewableLines > ROUTING.largeDiffLines) {
    warnings.push(`Large diff: ${reviewableLines} changed lines in reviewable files (> ${ROUTING.largeDiffLines}). Consider splitting the PR.`);
  }
  if (unmappedSkills.length) warnings.push(`Skills not in routing.json (not run): ${unmappedSkills.join(', ')}. Add them to routing.json or notReviewSkills.`);
  if (missingSkills.length) warnings.push(`routing.json references missing skills: ${missingSkills.join(', ')}.`);

  const run = {
    version: 1, created_at: new Date().toISOString(), mode: quick ? 'quick' : 'full', cache: useCache,
    branch, head, base, base_ref: baseRef, tree_sha: tree,
    snapshot, files, excluded, deleted, unrouted, reviewable_lines: reviewableLines,
    skills, checks, warnings,
  };
  writeJson(P.run, run);
  try { fs.rmSync(P.checks, { force: true }); } catch {}

  // human summary
  const toRun = Object.entries(skills).filter(([, s]) => s.toReview.length);
  console.log(`pr-self-review collect (${run.mode}${useCache ? '' : ', no cache'})`);
  console.log(`  branch ${branch} · base ${baseRef}@${base.slice(0, 8)} · snapshot ${tree.slice(0, 8)}`);
  console.log(`  files: ${files.length} reviewable, ${excluded.length} excluded, ${deleted.length} deleted, ${unrouted.length} without a skill`);
  console.log(`  checks: ${checks.length ? checks.map((c) => c.id).join(' | ') : 'none'}`);
  console.log('  skills:');
  for (const [s, v] of Object.entries(skills)) {
    console.log(`    ${s.padEnd(24)} ${v.files.length} file(s), ${v.toReview.length} to review, ${v.files.length - v.toReview.length} cached`);
  }
  if (!toRun.length) console.log('    (no skill needs a subagent this run)');
  for (const w of warnings) console.log(`  ! ${w}`);
  if (!Object.keys(snapshot).length) console.log('  diff vs main is empty — nothing to review.');
  console.log(`  → ${path.relative(ROOT, P.run)}`);
}

// ---------- checks ------------------------------------------------------------
function runChecks() {
  if (!fs.existsSync(P.run)) die('run `collect` first');
  const run = readJson(P.run);
  const results = [];
  for (const c of run.checks) {
    const cwd = path.join(ROOT, c.cwd);
    if (c.pkg && !fs.existsSync(path.join(cwd, 'node_modules'))) {
      results.push({ ...c, ok: false, skipped: true, output: `node_modules missing in ${c.cwd}/ — install deps, then re-run checks.` });
      console.log(`✗ ${c.id} — not run (deps missing)`);
      continue;
    }
    process.stdout.write(`… ${c.id}\n`);
    const r = spawnSync(c.cmd, { cwd, shell: true, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n');
    const ok = r.status === 0;
    results.push({ ...c, ok, exit: r.status, output });
    console.log(`${ok ? '✓' : '✗'} ${c.id}${ok ? '' : ` (exit ${r.status})`}`);
  }
  writeJson(P.checks, { tree_sha: run.tree_sha, ran_at: new Date().toISOString(), results });
  const failed = results.filter((r) => !r.ok).length;
  console.log(`checks: ${results.length - failed}/${results.length} passed → ${path.relative(ROOT, P.checks)}`);
}

// ---------- suppressions -------------------------------------------------------
const INLINE_RE = /pr-self-review-ignore\s+([a-z0-9-]+)\/([A-Za-z0-9_.*-]+)(?:\s*:\s*(.*?))?\s*(?:\*\/|-->|\}\s*$|$)/;

function loadIgnoreFile(extra) {
  if (!fs.existsSync(P.ignore)) return [];
  let list;
  try { list = readJson(P.ignore); } catch (e) {
    extra.push(mkFinding('pr-self-review', '.pr-self-review-ignore.json', 1, 'major', 'ignore-file-invalid', `Invalid JSON: ${e.message}`, 'Fix the JSON syntax.'));
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter((e, i) => {
    if (e && typeof e.reason === 'string' && e.reason.trim()) return true;
    extra.push(mkFinding('pr-self-review', '.pr-self-review-ignore.json', 1, 'major', 'suppression-missing-reason',
      `Entry #${i} (${e?.skill}/${e?.rule}) has no reason; it is ignored.`, 'Add a non-empty "reason".'));
    return false;
  });
}

function mkFinding(skill, file, line, severity, rule, evidence, fix) {
  return { skill, file, line, severity, rule, evidence, fix, confidence: 'high', verified: true };
}

function applySuppressions(findings, snapshot, extra) {
  const ignoreEntries = loadIgnoreFile(extra);
  const lineCache = new Map();
  const linesOf = (file) => {
    if (!lineCache.has(file)) lineCache.set(file, snapshot[file] ? blobContent(snapshot[file]).split('\n') : []);
    return lineCache.get(file);
  };
  const kept = [];
  const suppressed = [];
  const flagged = new Set();
  for (const f of findings) {
    if (f.unsuppressible) { kept.push(f); continue; }
    const fromFile = ignoreEntries.find((e) => e.skill === f.skill && (e.rule === '*' || e.rule === f.rule) && matchGlob(f.file, e.path ?? '**'));
    if (fromFile) { suppressed.push({ ...f, suppressed_by: '.pr-self-review-ignore.json', reason: fromFile.reason }); continue; }
    const lines = linesOf(f.file);
    let hit = null;
    for (const ln of [f.line, f.line - 1]) {
      const m = (lines[ln - 1] ?? '').match(INLINE_RE);
      if (m && m[1] === f.skill && (m[2] === '*' || m[2] === f.rule)) { hit = { ln, reason: (m[3] ?? '').trim() }; break; }
    }
    if (hit && hit.reason) { suppressed.push({ ...f, suppressed_by: `inline ${f.file}:${hit.ln}`, reason: hit.reason }); continue; }
    if (hit && !flagged.has(`${f.file}:${hit.ln}`)) {
      flagged.add(`${f.file}:${hit.ln}`);
      extra.push(mkFinding('pr-self-review', f.file, hit.ln, 'major', 'suppression-missing-reason',
        `Inline suppression for ${f.skill}/${f.rule} has no reason, so it is ignored.`, 'Write `pr-self-review-ignore <skill>/<rule>: <reason>`.'));
    }
    kept.push(f);
  }
  return { kept, suppressed };
}

// ---------- finalize ------------------------------------------------------------
function normalize(f, skill) {
  const out = {
    skill: f.skill || skill,
    file: String(f.file ?? ''),
    line: Number.isInteger(f.line) && f.line > 0 ? f.line : 1,
    severity: SEVERITIES.includes(f.severity) ? f.severity : 'major',
    rule: String(f.rule || 'unspecified'),
    evidence: String(f.evidence ?? ''),
    fix: String(f.fix ?? ''),
    confidence: f.confidence === 'high' ? 'high' : 'medium',
    verified: f.verified === true,
  };
  if (out.severity === 'critical' && !out.verified) {
    out.severity = 'major';
    out.note = 'critical not verified against the code by the orchestrator → downgraded to major';
  }
  return out;
}

function finalize(args) {
  const resultsPath = args[0];
  if (!fs.existsSync(P.run)) die('run `collect` first');
  const run = readJson(P.run);
  const results = resultsPath ? readJson(path.resolve(resultsPath)) : { results: [] };

  // the working tree must still be the snapshot that was reviewed (excluded files may drift)
  const now = changedMap(run.base, worktreeTree());
  const drift = [...new Set([...Object.keys(now), ...Object.keys(run.snapshot)])]
    .filter((f) => now[f] !== run.snapshot[f] && !isExcluded(f));
  if (drift.length) die(`working tree changed since collect (${drift.slice(0, 5).join(', ')}${drift.length > 5 ? ', …' : ''}). Re-run collect.`);

  let checks = { results: [] };
  if (run.checks.length) {
    if (!fs.existsSync(P.checks)) die('run `checks` before finalize');
    checks = readJson(P.checks);
    if (checks.tree_sha !== run.tree_sha) die('checks.json is from another snapshot; re-run `checks`');
  }

  const byResult = new Map((results.results ?? []).map((r) => [r.skill, r]));
  const all = [];
  const incomplete = [];
  const skillsRun = [];
  for (const [skill, info] of Object.entries(run.skills)) {
    for (const fs_ of Object.values(info.cached)) all.push(...fs_.map((f) => ({ ...f, cached: true })));
    if (!info.toReview.length) { skillsRun.push({ skill, files: info.files.length, reviewed: 0, cached: info.files.length }); continue; }
    const r = byResult.get(skill);
    if (!r || r.status !== 'ok') {
      incomplete.push({ skill, reason: r ? (r.error || r.status) : 'no result' });
      continue;
    }
    const allowed = new Set(info.toReview);
    const fresh = (r.findings ?? []).map((f) => normalize(f, skill)).filter((f) => allowed.has(f.file));
    all.push(...fresh);
    // cache per (skill, blob) — only for files this subagent actually reviewed
    for (const file of info.toReview) {
      writeJson(path.join(ROOT, info.cacheDir, `${run.snapshot[file]}.json`), {
        file, skill, cached_at: new Date().toISOString(), findings: fresh.filter((f) => f.file === file),
      });
    }
    skillsRun.push({ skill, files: info.files.length, reviewed: info.toReview.length, cached: info.files.length - info.toReview.length });
  }

  const extra = [];
  for (const c of checks.results ?? []) {
    if (c.ok) continue;
    extra.push({ ...mkFinding('checks', c.cwd === '.' ? 'scripts' : `${c.cwd}/`, 1, 'critical', c.id,
      c.output, c.skipped ? 'Install dependencies and re-run.' : 'Fix the failing check (CI runs the same command).'), unsuppressible: true });
  }
  for (const i of incomplete) {
    extra.push({ ...mkFinding('pr-self-review', `(skill: ${i.skill})`, 1, 'critical', 'skill-review-incomplete',
      `Skill ${i.skill} did not finish (${i.reason}); its files are unreviewed.`, 'Re-run /pr-self-review.'), unsuppressible: true });
  }

  const { kept, suppressed } = applySuppressions([...all, ...extra.filter((e) => e.unsuppressible)], run.snapshot, extra);
  const findings = [...kept, ...extra.filter((e) => !e.unsuppressible)];

  // dedupe: same file:line from several skills → one entry, max severity
  const groups = new Map();
  for (const f of findings) {
    const k = `${f.file}:${f.line}`;
    const g = groups.get(k);
    if (!g) { groups.set(k, { ...f, skills: [f.skill], rules: [f.rule] }); continue; }
    if (SEVERITIES.indexOf(f.severity) < SEVERITIES.indexOf(g.severity)) Object.assign(g, { severity: f.severity, evidence: f.evidence, fix: f.fix });
    if (!g.skills.includes(f.skill)) g.skills.push(f.skill);
    if (!g.rules.includes(f.rule)) g.rules.push(f.rule);
  }
  const merged = [...groups.values()].sort((a, b) =>
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, merged.filter((f) => f.severity === s).length]));
  const verdict = counts.critical > 0 ? 'BLOCK' : 'PASS';
  const criticals = merged.filter((f) => f.severity === 'critical')
    .map((f) => ({ file: f.file, line: f.line, skills: f.skills, rules: f.rules, fix: f.fix }));

  const v = {
    version: 1, verdict, mode: run.mode, created_at: new Date().toISOString(),
    branch: run.branch, base: run.base, base_ref: run.base_ref, tree_sha: run.tree_sha,
    snapshot: run.snapshot, counts, criticals, suppressed: suppressed.length,
    skills_run: skillsRun, checks: (checks.results ?? []).map((c) => ({ id: c.id, ok: c.ok })),
  };
  writeJson(P.verdict, v);
  fs.writeFileSync(P.report, renderReport(run, v, merged, suppressed, checks));
  if (verdict === 'PASS') fs.writeFileSync(P.body, renderBody(run, v, merged, suppressed));
  else fs.rmSync(P.body, { force: true });

  console.log(`pr-self-review: ${verdict}  (critical ${counts.critical} · major ${counts.major} · minor ${counts.minor} · suppressed ${suppressed.length})`);
  for (const c of criticals) console.log(`  ✗ ${c.file}:${c.line} [${c.skills.join(', ')}] ${c.rules.join(', ')}`);
  console.log(`  report → ${path.relative(ROOT, P.report)}${verdict === 'PASS' ? `\n  PR body → ${path.relative(ROOT, P.body)}` : ''}`);
  process.exitCode = verdict === 'PASS' ? 0 : 3;
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').slice(0, 400);

function renderReport(run, v, findings, suppressed, checks) {
  const L = [];
  L.push(`# PR self-review — ${v.verdict}`, '');
  L.push(`Branch \`${run.branch}\` · base \`${run.base_ref}@${run.base.slice(0, 8)}\` · snapshot \`${run.tree_sha.slice(0, 8)}\` · mode ${run.mode} · ${v.created_at}`, '');
  L.push(`**critical ${v.counts.critical} · major ${v.counts.major} · minor ${v.counts.minor} · suppressed ${suppressed.length}**`, '');
  if (run.warnings.length) { L.push('## Warnings', ''); run.warnings.forEach((w) => L.push(`- ${w}`)); L.push(''); }
  L.push('## Checks', '');
  if (!(checks.results ?? []).length) L.push('_none for the touched packages_');
  for (const c of checks.results ?? []) L.push(`- ${c.ok ? '✓' : '✗'} \`${c.id}\``);
  L.push('', '## Skills', '', '| Skill | Files | Reviewed now | From cache |', '|---|---|---|---|');
  for (const s of v.skills_run) L.push(`| ${s.skill} | ${s.files} | ${s.reviewed} | ${s.cached} |`);
  if (run.unrouted.length) L.push('', `Files without a skill (checks only): ${run.unrouted.map((f) => `\`${f}\``).join(', ')}`);
  for (const sev of SEVERITIES) {
    const list = findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    L.push('', `## ${sev[0].toUpperCase()}${sev.slice(1)} (${list.length})`, '');
    let lastFile = null;
    for (const f of list) {
      if (f.file !== lastFile) { L.push(`### \`${f.file}\``, ''); lastFile = f.file; }
      if (f.skill === 'checks') {
        L.push(`- **${f.rules.join(', ')}** failed`, '', '  ```', ...f.evidence.split('\n').slice(-30).map((l) => `  ${l}`), '  ```', `  → ${f.fix}`, '');
        continue;
      }
      L.push(`- **L${f.line}** · ${f.skills.join(', ')} · \`${f.rules.join('`, `')}\`${f.cached ? ' · cached' : ''}`);
      if (f.evidence) L.push(`  - ${esc(f.evidence)}`);
      if (f.fix) L.push(`  - Fix: ${esc(f.fix)}`);
      if (f.note) L.push(`  - _${f.note}_`);
    }
  }
  if (suppressed.length) {
    L.push('', `## Suppressed (${suppressed.length})`, '', '| Where | Skill/rule | Severity | Reason |', '|---|---|---|---|');
    for (const s of suppressed) L.push(`| \`${s.file}:${s.line}\` | ${s.skill}/${s.rule} | ${s.severity} | ${esc(s.reason)} |`);
  }
  return L.join('\n') + '\n';
}

function renderBody(run, v, findings, suppressed) {
  const byPkg = {};
  for (const f of [...run.files.map((x) => x.path), ...run.excluded, ...run.deleted]) {
    const pkg = f.includes('/') ? f.split('/')[0] : '(root)';
    byPkg[pkg] = (byPkg[pkg] ?? 0) + 1;
  }
  const L = [];
  L.push('## Summary', '', '<!-- What and why — fill in -->', '');
  L.push('## Changed areas', '');
  for (const [p, n] of Object.entries(byPkg).sort()) L.push(`- \`${p}/\` — ${n} file(s)`);
  L.push('', '## Self-review', '');
  L.push(`- Checks: ${v.checks.length ? v.checks.map((c) => `${c.ok ? '✓' : '✗'} \`${c.id}\``).join(', ') : 'none'}`);
  L.push(`- Skills: ${v.skills_run.map((s) => s.skill).join(', ') || 'none'}${run.mode === 'quick' ? ' (quick mode)' : ''}`);
  const rest = findings.filter((f) => f.severity !== 'critical');
  if (rest.length) {
    L.push('', '<details><summary>Remaining major/minor findings (' + rest.length + ')</summary>', '');
    for (const f of rest) L.push(`- **${f.severity}** \`${f.file}:${f.line}\` (${f.skills.join(', ')}) — ${esc(f.evidence).slice(0, 200)}`);
    L.push('', '</details>');
  }
  if (suppressed.length) {
    L.push('', '### Suppressed findings', '');
    for (const s of suppressed) L.push(`- \`${s.file}:${s.line}\` ${s.skill}/${s.rule} (${s.severity}) — ${esc(s.reason)}`);
  }
  L.push('', `\`pr-self-review: PASS @ ${v.tree_sha.slice(0, 7)}\``);
  return L.join('\n') + '\n';
}

// ---------- gate ----------------------------------------------------------------
/** Returns null when allowed, else a human-readable reason. */
function gateFor(commit) {
  const { base } = resolveBase(commit);
  const pushed = changedMap(base, commit);
  const relevant = Object.keys(pushed).filter((f) => !isExcluded(f));
  if (!relevant.length) return null; // nothing reviewable vs main
  if (!fs.existsSync(P.verdict)) return 'no self-review verdict found. Run /pr-self-review first.';
  const v = readJson(P.verdict);
  if (v.verdict !== 'PASS') {
    const list = (v.criticals ?? []).map((c) => `  - ${c.file}:${c.line} [${c.skills.join(', ')}] ${c.rules.join(', ')}`).join('\n');
    return `last self-review is BLOCK (${v.counts?.critical ?? '?'} critical):\n${list}\nFix them and re-run /pr-self-review. Report: ${path.relative(ROOT, P.report)}`;
  }
  const stale = relevant.filter((f) => !(f in v.snapshot) || v.snapshot[f] !== pushed[f]);
  if (stale.length) {
    return `verdict is stale: ${stale.length} file(s) in the pushed commit differ from what was reviewed (${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', …' : ''}). Re-run /pr-self-review (cached files are not re-reviewed).`;
  }
  return null;
}

function skipRequested() {
  return process.env.PR_SELF_REVIEW_SKIP === '1';
}

function gate(args) {
  if (skipRequested()) { console.error('pr-self-review: gate skipped (PR_SELF_REVIEW_SKIP=1)'); return; }
  const targets = [];
  if (args.includes('--pre-push')) {
    const stdin = fs.readFileSync(0, 'utf8');
    for (const line of stdin.split('\n')) {
      const [localRef, localSha] = line.trim().split(/\s+/);
      if (!localSha || localSha === ZERO_SHA) continue; // branch deletion
      if (!localRef.startsWith('refs/heads/')) continue; // tags etc.
      if (MAIN_BRANCHES.has(localRef.slice('refs/heads/'.length))) continue;
      targets.push(localSha);
    }
  } else {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (!MAIN_BRANCHES.has(branch)) targets.push('HEAD');
  }
  for (const t of targets) {
    const reason = gateFor(t);
    if (reason) {
      console.error(`✗ pr-self-review gate: ${reason}\n  (deliberate bypass: PR_SELF_REVIEW_SKIP=1 or git push --no-verify)`);
      process.exit(1);
    }
  }
}

// ---------- Claude Code PreToolUse hook --------------------------------------------
function hook() {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return; }
  const cmd = String(input?.tool_input?.command ?? '');
  const isPr = /\bgh\s+pr\s+create\b/.test(cmd);
  const isPush = /\bgit\s+push\b/.test(cmd) && !/\s(--delete|-d)\b/.test(cmd);
  if (!isPr && !isPush) return;
  if (skipRequested() || /\bPR_SELF_REVIEW_SKIP=1\b/.test(cmd)) return;
  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || MAIN_BRANCHES.has(branch)) return;
  const reason = gateFor('HEAD');
  if (reason) {
    console.error(`pr-self-review gate blocked \`${isPr ? 'gh pr create' : 'git push'}\`: ${reason}\n` +
      'Run the pr-self-review skill (/pr-self-review). Do not bypass the gate unless the user explicitly asks.');
    process.exit(2);
  }
  if (isPr && !/\s(--body|--body-file|-b|-F|--fill|--fill-first|--fill-verbose)\b/.test(cmd) && fs.existsSync(P.body)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `pr-self-review wrote a PR body draft at ${path.relative(ROOT, P.body)}; pass it with --body-file.`,
      },
    }));
  }
}

function status() {
  if (!fs.existsSync(P.verdict)) { console.log('no verdict yet'); return; }
  const v = readJson(P.verdict);
  console.log(`${v.verdict} @ ${v.tree_sha.slice(0, 8)} (${v.mode}, ${v.created_at}) — critical ${v.counts.critical}, major ${v.counts.major}, minor ${v.counts.minor}`);
  const reason = MAIN_BRANCHES.has(git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()) ? null : gateFor('HEAD');
  console.log(reason ? `gate for HEAD: ✗ ${reason}` : 'gate for HEAD: ✓ open');
}

// ---------- main ------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const commands = { collect, checks: runChecks, finalize, gate, hook, status };
if (!commands[cmd]) die(`usage: prsr.mjs <${Object.keys(commands).join('|')}> [args]`, 2);
commands[cmd](rest);

#!/usr/bin/env node
/**
 * audit-diff.js — pairs structural snapshots from audit-prod and audit-local
 * Playwright runs and prints a per-scenario divergence report.
 *
 * Usage:
 *   yarn test:e2e --project=audit-prod --project=audit-local
 *   node scripts/audit-diff.js
 *
 * Reads test-results/audit-audit-<scenario>-audit-{prod,local}/<scenario>.state.json
 * (written by e2e/audit.spec.js) and emits a unified-ish diff of top-level
 * structural fields plus a line-based diff of the rendered body text.
 *
 * Exit code: always 0. Divergences are expected during the migration —
 * the audit's role is to document them, not to prosecute them.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS_DIR = 'test-results';
// Playwright directory naming convention: <test-file>-<test-title-slug>-<project-name>
// e2e/audit.spec.js × test('audit: <scenario>') × project 'audit-prod' =>
//   "audit-audit-<scenario>-audit-prod"
// The leading "audit-" comes from the test file name; the second "audit-"
// comes from the test title's "audit: " prefix.
const DIR_RE = /^audit-audit-(.+)-audit-(prod|local)$/;

const color = process.stdout.isTTY
  ? {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
    }
  : {
      red: (s) => s,
      green: (s) => s,
      yellow: (s) => s,
      cyan: (s) => s,
      bold: (s) => s,
      dim: (s) => s,
    };

// Pair up prod/local directories by scenario name.
function findScenarios() {
  if (!existsSync(RESULTS_DIR)) {
    // Exit 1 — the audit pipeline is `test:e2e:audit = playwright && diff`,
    // so a missing results dir here means playwright somehow succeeded
    // without producing output, which is a real pipeline failure that
    // CI and humans need to see. Exit 0 would let the `&&` chain report
    // success on an audit that produced no data.
    console.error(`${RESULTS_DIR}/ not found — run the audit first.`);
    process.exit(1);
  }
  const pairs = {};
  for (const entry of readdirSync(RESULTS_DIR)) {
    const m = DIR_RE.exec(entry);
    if (!m) continue;
    const [, scenario, env] = m;
    pairs[scenario] = pairs[scenario] || {};
    const stateFile = join(RESULTS_DIR, entry, `${scenario}.state.json`);
    if (existsSync(stateFile)) pairs[scenario][env] = stateFile;
  }
  return pairs;
}

function loadState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    return { loadError: e.message };
  }
}

// Deep-ish equality that treats arrays as ordered and objects as unordered.
// Returns true if equal.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    if (!ka.every((k, i) => k === kb[i])) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// Compact a value for single-line display. Long strings get truncated.
function show(v) {
  if (v === undefined) return color.dim('(missing)');
  if (v === null) return 'null';
  if (typeof v === 'string') {
    if (v.length > 80) return JSON.stringify(v.slice(0, 77)) + '…';
    return JSON.stringify(v);
  }
  const s = JSON.stringify(v);
  if (s.length > 80) return s.slice(0, 77) + '…';
  return s;
}

// Line-set diff for body text. Returns { onlyInProd, onlyInLocal, common }.
// Uses set semantics because the two renderings may interleave the same
// user-visible lines in different DOM order and still be "the same page".
function bodyTextDiff(prodText, localText) {
  if (!prodText && !localText) return null;
  const prodLines = new Set(
    (prodText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const localLines = new Set(
    (localText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const onlyInProd = [...prodLines].filter((l) => !localLines.has(l));
  const onlyInLocal = [...localLines].filter((l) => !prodLines.has(l));
  return { onlyInProd, onlyInLocal };
}

// Fields to compare as top-level scalars/objects. `bodyTextFull` is
// excluded because it's diffed with the line-set approach below; the
// sample is excluded because it's a prefix of the full text.
const STRUCTURAL_FIELDS = [
  'title',
  'hash',
  'docRowCount',
  'engineTabsLocal',
  'engineRadiosProd',
  'dataRoles',
  'bodyTextLen',
  'splainerServicesGlobal',
  'angularFootprint',
  'pageErrorCount',
  'pageErrors',
];

function reportScenario(scenario, prodState, localState) {
  const header = `━━━ ${color.bold(scenario)} ━━━`;
  console.log('');
  console.log(color.cyan(header));

  const divergences = [];

  for (const field of STRUCTURAL_FIELDS) {
    const pv = prodState[field];
    const lv = localState[field];
    if (!deepEqual(pv, lv)) {
      divergences.push({ field, pv, lv });
    }
  }

  if (divergences.length === 0) {
    console.log(color.green('  ✓ no structural divergences'));
  } else {
    console.log(color.yellow(`  ${divergences.length} structural field(s) differ:`));
    for (const { field, pv, lv } of divergences) {
      console.log(`    ${color.bold(field)}`);
      console.log(`      ${color.red('prod  ')} ${show(pv)}`);
      console.log(`      ${color.green('local ')} ${show(lv)}`);
    }
  }

  // Body text line-set diff — separate from the structural fields because
  // the output is multi-line and warrants its own section.
  const bodyDiff = bodyTextDiff(prodState.bodyTextFull, localState.bodyTextFull);
  if (bodyDiff && (bodyDiff.onlyInProd.length || bodyDiff.onlyInLocal.length)) {
    console.log(color.yellow('  body text line differences (set diff):'));
    if (bodyDiff.onlyInProd.length) {
      console.log(color.red(`    only in prod (${bodyDiff.onlyInProd.length}):`));
      for (const line of bodyDiff.onlyInProd.slice(0, 15)) {
        console.log(color.red(`      - ${line}`));
      }
      if (bodyDiff.onlyInProd.length > 15) {
        console.log(color.dim(`      … and ${bodyDiff.onlyInProd.length - 15} more`));
      }
    }
    if (bodyDiff.onlyInLocal.length) {
      console.log(color.green(`    only in local (${bodyDiff.onlyInLocal.length}):`));
      for (const line of bodyDiff.onlyInLocal.slice(0, 15)) {
        console.log(color.green(`      + ${line}`));
      }
      if (bodyDiff.onlyInLocal.length > 15) {
        console.log(color.dim(`      … and ${bodyDiff.onlyInLocal.length - 15} more`));
      }
    }
  } else if (bodyDiff) {
    console.log(color.green('  ✓ body text lines identical (set diff)'));
  }

  return divergences.length + (bodyDiff ? bodyDiff.onlyInProd.length + bodyDiff.onlyInLocal.length : 0);
}

function main() {
  const pairs = findScenarios();
  const scenarios = Object.keys(pairs).sort();

  if (scenarios.length === 0) {
    console.log('No audit state.json files found. Run:');
    console.log('  yarn test:e2e --project=audit-prod --project=audit-local');
    return;
  }

  console.log(color.bold(`Audit divergence report (${scenarios.length} scenarios)`));

  let totalDivergences = 0;
  const missing = [];
  for (const scenario of scenarios) {
    const pair = pairs[scenario];
    if (!pair.prod || !pair.local) {
      missing.push({ scenario, pair });
      continue;
    }
    const prodState = loadState(pair.prod);
    const localState = loadState(pair.local);
    totalDivergences += reportScenario(scenario, prodState, localState);
  }

  console.log('');
  console.log(color.bold('━━━ summary ━━━'));
  console.log(`  scenarios compared: ${scenarios.length - missing.length}`);
  console.log(`  total divergences:  ${totalDivergences}`);
  if (missing.length) {
    console.log(color.yellow(`  incomplete pairs:   ${missing.length}`));
    for (const { scenario, pair } of missing) {
      const have = Object.keys(pair).join(', ') || 'neither';
      console.log(color.yellow(`    - ${scenario} (have: ${have})`));
    }
  }
}

main();

#!/usr/bin/env node
import {
  DEFAULT_RULES,
  buildTape,
  calibrate,
  replayTape,
  contrastChase,
  splitYdayToday,
} from './engine.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function args() {
  const a = process.argv.slice(2);
  const out = { cmd: a[0] || 'demo', seed: 77 };
  for (let i = 1; i < a.length; i++) {
    if (a[i] === '--seed') out.seed = Number(a[++i]);
  }
  return out;
}

function printSum(label, s, rules) {
  console.log(`\n=== ${label} ===`);
  if (rules) console.log(`rules: ${rules.version}`);
  console.log(
    `n=${s.n} traded=${s.traded} skip=${s.skipped} chaseAvoid=${s.chaseAvoid ?? '—'}`
  );
  console.log(
    `hit=${(s.hitRate * 100).toFixed(1)}%  avg=${s.avgPnlPct.toFixed(2)}%  E=${s.expectancy.toFixed(4)} SOL`
  );
}

function demo(opt) {
  const tape = buildTape({ seed: opt.seed, perDay: 40 });
  const { yday, today } = splitYdayToday(tape);
  const { best, tried } = calibrate(yday);
  const pool = today.slice(-30);
  const base = replayTape(pool, DEFAULT_RULES);
  const next = replayTape(pool, best);
  const contrast = contrastChase(pool, best);

  console.log('QUIETR — wait for silence, enter second wave');
  console.log(`tape ${tape.length} · yday ${yday.length} · today ${today.length} · grid ${tried}`);
  printSum('BASE', base.summary, DEFAULT_RULES);
  printSum('NEXT (yday calib)', next.summary, best);
  console.log('\nvs chase-first candle:');
  console.log(
    `  quietr avg ${contrast.quietr.avgPnlPct.toFixed(2)}% · chase avg ${contrast.chase.avgPnlPct.toFixed(2)}% · delta ${contrast.bleedDelta.toFixed(2)}%`
  );
  console.log('\nlast trades:');
  for (const r of next.results.filter((x) => x.entry).slice(-8)) {
    console.log(
      `  ${r.name.padEnd(10)} ${r.status.padEnd(6)} ${(r.pnlPct >= 0 ? '+' : '') + r.pnlPct.toFixed(1)}%`
    );
  }
  return { best, next, contrast, pool };
}

function runCal(opt) {
  mkdirSync(resolve(root, 'data'), { recursive: true });
  const { yday } = splitYdayToday(buildTape({ seed: opt.seed, perDay: 50 }));
  const { best, top, tried } = calibrate(yday);
  printSum(`CALIBRATED (${tried} trials)`, best.calibSummary, best);
  top.forEach((t, i) =>
    console.log(`  ${i + 1}. ${t.rules.version} E=${t.summary.expectancy.toFixed(4)}`)
  );
  writeFileSync(
    resolve(root, 'data', 'next-rules.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), rules: best }, null, 2)
  );
  console.log('\nwrote data/next-rules.json');
}

function runJson(opt) {
  mkdirSync(resolve(root, 'data'), { recursive: true });
  const d = demo(opt);
  writeFileSync(
    resolve(root, 'data', 'desk-state.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        nextRules: d.best,
        summary: d.next.summary,
        contrast: d.contrast,
        sample: d.next.results.slice(-16),
      },
      null,
      2
    )
  );
  console.log('\nwrote data/desk-state.json');
}

const opt = args();
if (opt.cmd === 'calibrate') runCal(opt);
else if (opt.cmd === 'json') runJson(opt);
else if (opt.cmd === 'replay') {
  const { today } = splitYdayToday(buildTape({ seed: opt.seed }));
  const run = replayTape(today.slice(-24), DEFAULT_RULES);
  printSum('REPLAY', run.summary, DEFAULT_RULES);
} else demo(opt);

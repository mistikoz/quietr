/**
 * QUIETR engine — don't chase first candle.
 * Wait for silence after first dump (volume collapse + spread ok), enter second wave.
 */
export const DEFAULT_RULES = {
  version: 'QUIETR_v1.0',
  // first-leg dump must print before we arm silence
  dump: {
    minDropPct: 18, // candle-one bleed threshold from local high
    maxAgeMin: 8, // dump must happen early
  },
  silence: {
    volCollapse: 0.35, // volume ≤ 35% of dump-leg avg
    maxSpreadBps: 45, // spread ok
    holdBars: 3, // quiet bars required
  },
  entry: {
    secondLegLiftPct: 6, // break silence with lift
    sizeSolMin: 0.2,
    sizeSolMax: 0.9,
    skipIfRug: 75,
  },
  exit: {
    takePct: 38,
    cutPct: -22,
    maxHoldMin: 40,
  },
};

export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const ROOTS = [
  'QUIET', 'MUTE', 'HUSH', 'STILL', 'SOFT', 'VOID', 'DIM', 'CALM', 'LOW', 'FADE',
  'FROG', 'PEPE', 'WIF', 'BONK', 'MOON', 'DRIP', 'ZAP', 'SEED', 'GIGA', 'CHAD',
];
const TAIL = ['R', 'X', 'AI', 'SOL', 'FUN', 'BOT', 'OS', 'MAX'];

export function mintName(seed, i = 0) {
  const a = ROOTS[Math.floor(hash(seed + i) * ROOTS.length)];
  if (hash(seed * 3 + i) < 0.45) return a;
  return (a + TAIL[Math.floor(hash(seed * 5 + i) * TAIL.length)]).slice(0, 10);
}

/** Synthetic mint path: pump → dump → quiet → optional second leg. */
export function synthesizeMint(seed, nowMs = Date.now(), maxAgeMin = 120) {
  const createdAt = nowMs - Math.floor(hash(seed) * maxAgeMin) * 60_000;
  const name = mintName(seed);
  const rugScore = Math.floor(hash(seed * 1.7) * 100);
  const ticks = [];
  let price = 1;
  let high = 1;
  let phase = 'pump';
  let dumpStart = -1;
  let quietStart = -1;
  const n = 56 + Math.floor(hash(seed * 6) * 24);
  let dumpVolSum = 0;
  let dumpVolN = 0;

  for (let i = 0; i < n; i++) {
    const t = createdAt + i * 60_000;
    let vol = 1.2 + hash(seed * 14 + i) * 3.5;
    let spreadBps = 20 + hash(seed * 15 + i) * 50;

    if (i < 6) {
      // first candle chase zone — hot volume
      price *= 1 + 0.04 + hash(seed * 10 + i) * 0.08;
      vol *= 1.6;
      phase = 'pump';
    } else if (i < 14) {
      // first dump
      price *= 1 - (0.03 + hash(seed * 11 + i) * 0.05);
      vol *= 1.3;
      phase = 'dump';
      if (dumpStart < 0) dumpStart = i;
      dumpVolSum += vol;
      dumpVolN += 1;
    } else if (i < 14 + 4 + Math.floor(hash(seed * 9) * 5)) {
      // silence / volume collapse
      price *= 1 + (hash(seed * 12 + i) - 0.5) * 0.012;
      vol *= 0.22 + hash(seed * 13 + i) * 0.12;
      spreadBps = 12 + hash(seed * 16 + i) * 25;
      phase = 'quiet';
      if (quietStart < 0) quietStart = i;
    } else {
      // second leg
      const lift = hash(seed * 17 + i) > 0.35;
      price *= lift ? 1 + 0.02 + hash(seed * 18 + i) * 0.05 : 1 - 0.01;
      vol *= 0.7 + hash(seed * 19 + i) * 0.9;
      phase = 'second';
    }

    high = Math.max(high, price);
    const dropFromHigh = ((high - price) / high) * 100;
    ticks.push({
      t,
      i,
      price,
      high,
      dropFromHigh,
      vol,
      spreadBps,
      phase,
    });
  }

  return {
    mint: `q${seed.toString(16).padStart(8, '0')}`,
    name,
    symbol: name.slice(0, 6),
    createdAt,
    rugScore,
    dumpVolAvg: dumpVolN ? dumpVolSum / dumpVolN : 1,
    ticks,
  };
}

export function buildTape({ days = 2, perDay = 36, seed = 77, nowMs = Date.now() } = {}) {
  const dayMs = 86_400_000;
  const mints = [];
  let k = seed;
  for (let d = days - 1; d >= 0; d--) {
    const dayNow = nowMs - d * dayMs;
    const maxAgeMin = d === 0 ? 180 : 24 * 60;
    for (let i = 0; i < perDay; i++) {
      k += 1;
      const m = synthesizeMint(k, dayNow, maxAgeMin);
      m.dayOffset = d;
      mints.push(m);
    }
  }
  return mints.sort((a, b) => a.createdAt - b.createdAt);
}

export function sizeSol(rules, mint) {
  const span = rules.entry.sizeSolMax - rules.entry.sizeSolMin;
  const w = 1 - clamp(mint.rugScore / 100, 0, 1);
  return +(rules.entry.sizeSolMin + span * w).toFixed(3);
}

function detectDump(mint, rules) {
  for (const tick of mint.ticks) {
    const ageMin = (tick.t - mint.createdAt) / 60_000;
    if (ageMin > rules.dump.maxAgeMin) break;
    if (tick.dropFromHigh >= rules.dump.minDropPct && tick.phase === 'dump') {
      return tick;
    }
  }
  // fallback: max drop in early window
  let best = null;
  for (const tick of mint.ticks) {
    const ageMin = (tick.t - mint.createdAt) / 60_000;
    if (ageMin > rules.dump.maxAgeMin) break;
    if (!best || tick.dropFromHigh > best.dropFromHigh) best = tick;
  }
  if (best && best.dropFromHigh >= rules.dump.minDropPct) return best;
  return null;
}

function silenceOk(tick, mint, rules) {
  const volRatio = tick.vol / Math.max(1e-6, mint.dumpVolAvg);
  return (
    volRatio <= rules.silence.volCollapse &&
    tick.spreadBps <= rules.silence.maxSpreadBps
  );
}

/**
 * Replay one mint with QUIETR rules.
 * Skip chasing first pump. Require dump → quiet hold → second-leg lift.
 */
export function replayMint(mint, rules = DEFAULT_RULES) {
  if (mint.rugScore >= rules.entry.skipIfRug) {
    return pack(mint, rules, null, null, 'SKIP_RUG');
  }

  const dump = detectDump(mint, rules);
  if (!dump) return pack(mint, rules, null, null, 'NO_DUMP');

  let quietCount = 0;
  let armed = false;
  let entry = null;
  let exit = null;
  const dumpIdx = mint.ticks.findIndex((x) => x.t === dump.t);

  for (let i = dumpIdx + 1; i < mint.ticks.length; i++) {
    const tick = mint.ticks[i];

    if (!armed) {
      if (silenceOk(tick, mint, rules)) quietCount += 1;
      else quietCount = 0;
      if (quietCount >= rules.silence.holdBars) armed = true;
      continue;
    }

    if (!entry) {
      const liftFromQuiet = ((tick.price / dump.price) - 1) * 100;
      // second wave: price lifts off dump floor after silence
      if (liftFromQuiet >= rules.entry.secondLegLiftPct && tick.phase !== 'dump') {
        entry = {
          t: tick.t,
          price: tick.price,
          sizeSol: sizeSol(rules, mint),
          quietBars: quietCount,
          dumpDrop: dump.dropFromHigh,
        };
      }
      continue;
    }

    const pnlPct = ((tick.price / entry.price) - 1) * 100;
    const heldMin = (tick.t - entry.t) / 60_000;
    if (pnlPct >= rules.exit.takePct) {
      exit = { t: tick.t, price: tick.price, pnlPct, reason: 'TAKE' };
      break;
    }
    if (pnlPct <= rules.exit.cutPct) {
      exit = { t: tick.t, price: tick.price, pnlPct, reason: 'CUT' };
      break;
    }
    if (heldMin >= rules.exit.maxHoldMin) {
      exit = { t: tick.t, price: tick.price, pnlPct, reason: 'TIME' };
      break;
    }
  }

  if (entry && !exit) {
    const last = mint.ticks[mint.ticks.length - 1];
    const pnlPct = ((last.price / entry.price) - 1) * 100;
    exit = { t: last.t, price: last.price, pnlPct, reason: 'EOD' };
  }

  if (!armed && !entry) return pack(mint, rules, null, null, 'NO_SILENCE');
  if (armed && !entry) return pack(mint, rules, null, null, 'NO_SECOND_LEG');
  return pack(mint, rules, entry, exit, exit.reason);
}

function pack(mint, rules, entry, exit, status) {
  const pnlPct = exit ? exit.pnlPct : 0;
  const pnlSol = entry ? entry.sizeSol * (pnlPct / 100) : 0;
  return {
    mint: mint.mint,
    name: mint.name,
    status,
    entry,
    exit,
    pnlPct,
    pnlSol,
    rulesVersion: rules.version,
  };
}

export function summarize(results) {
  const traded = results.filter((r) => r.entry);
  const wins = traded.filter((r) => r.pnlPct > 0);
  const chaseAvoid = results.filter((r) =>
    ['NO_DUMP', 'NO_SILENCE', 'NO_SECOND_LEG', 'SKIP_RUG'].includes(r.status)
  ).length;
  const pnlSol = traded.reduce((s, r) => s + r.pnlSol, 0);
  const avg = traded.length
    ? traded.reduce((s, r) => s + r.pnlPct, 0) / traded.length
    : 0;
  return {
    n: results.length,
    traded: traded.length,
    skipped: results.length - traded.length,
    wins: wins.length,
    losses: traded.length - wins.length,
    hitRate: traded.length ? wins.length / traded.length : 0,
    avgPnlPct: avg,
    pnlSol,
    expectancy: traded.length ? pnlSol / traded.length : 0,
    chaseAvoid,
  };
}

export function replayTape(mints, rules = DEFAULT_RULES) {
  const results = mints.map((m) => replayMint(m, rules));
  return { results, summary: summarize(results), rules };
}

/** Naive chase-first strategy for contrast metrics. */
export function replayChaseFirst(mint) {
  const tick = mint.ticks[2] || mint.ticks[0];
  if (!tick) return { name: mint.name, status: 'NO_DATA', pnlPct: 0, pnlSol: 0, entry: null };
  const entry = { t: tick.t, price: tick.price, sizeSol: 0.5 };
  let exit = null;
  for (const x of mint.ticks) {
    if (x.t <= entry.t) continue;
    const pnlPct = ((x.price / entry.price) - 1) * 100;
    if (pnlPct <= -18) {
      exit = { pnlPct, reason: 'BLEED' };
      break;
    }
    if (pnlPct >= 25) {
      exit = { pnlPct, reason: 'TAKE' };
      break;
    }
  }
  if (!exit) {
    const last = mint.ticks[mint.ticks.length - 1];
    exit = { pnlPct: ((last.price / entry.price) - 1) * 100, reason: 'EOD' };
  }
  return {
    name: mint.name,
    status: exit.reason,
    entry,
    exit,
    pnlPct: exit.pnlPct,
    pnlSol: entry.sizeSol * (exit.pnlPct / 100),
  };
}

export function contrastChase(mints, rules = DEFAULT_RULES) {
  const quiet = replayTape(mints, rules);
  const chase = mints.map(replayChaseFirst);
  const chaseSum = summarize(chase.map((c) => ({ ...c, entry: c.entry || null })));
  return {
    quietr: quiet.summary,
    chase: chaseSum,
    bleedDelta: chaseSum.avgPnlPct - quiet.summary.avgPnlPct,
  };
}

export function splitYdayToday(mints) {
  const yday = mints.filter((m) => m.dayOffset === 1);
  const today = mints.filter((m) => m.dayOffset === 0);
  return { yday, today };
}

export function calibrate(ydayMints, base = DEFAULT_RULES) {
  const grid = [];
  for (const minDropPct of [12, 18, 24]) {
    for (const volCollapse of [0.25, 0.35, 0.45]) {
      for (const holdBars of [2, 3, 4]) {
        for (const lift of [4, 6, 9]) {
          const rules = {
            ...base,
            version: `CAL_${minDropPct}_${volCollapse}_${holdBars}_${lift}`,
            dump: { ...base.dump, minDropPct },
            silence: { ...base.silence, volCollapse, holdBars },
            entry: { ...base.entry, secondLegLiftPct: lift },
          };
          const { summary } = replayTape(ydayMints, rules);
          grid.push({
            rules,
            summary,
            score: summary.expectancy * 100 + summary.hitRate * 12 - Math.max(0, -summary.avgPnlPct),
          });
        }
      }
    }
  }
  grid.sort((a, b) => b.score - a.score);
  const best = grid[0];
  const next = {
    ...best.rules,
    version: bump(base.version),
    calibratedOn: 'yesterday',
    calibSummary: best.summary,
    calibScore: best.score,
  };
  return { best: next, top: grid.slice(0, 5), tried: grid.length };
}

function bump(v) {
  const m = String(v).match(/v(\d+)\.(\d+)/);
  if (!m) return 'QUIETR_v1.1';
  return `QUIETR_v${m[1]}.${Number(m[2]) + 1}`;
}

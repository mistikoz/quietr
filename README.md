# QUIETR

**Desk 7** — vibelancer × pump.fun targeting HUD.

Don't chase the first candle. Wait for **silence** after the first dump (volume collapse + spread ok), then enter the **second wave**.

## Mechanic

```text
01 FIRST CANDLE   → IGNORE (no chase)
02 DUMP LEG       → ARM when drop ≥ threshold
03 SILENCE        → vol ≤ X% of dump avg + spread ok + hold N bars
04 SECOND WAVE    → enter on lift off dump floor
```

**Upgrade vs candle-one:** less first-leg bleed, more second-leg prints.

## Run

```bash
npm run demo        # calib + quietr vs chase-first contrast
npm run calibrate   # → data/next-rules.json
npm run replay
npm run desk        # http://localhost:5180  (1920×1080 HUD)
```

Buttons on desk: **RUN DEMO / CALIBRATE / REPLAY** — same engine as CLI (`src/engine.mjs`).

## Visual

AJDesign-style **targeting HUD**: rotating ticks, radar sweep, lock brackets, scanlines, wireframe panels, path trace (pump → dump → quiet → leg2).

Labels: **QUIETR** · **VIBELANCER** · **PUMP.FUN**

Ref pin energy: [Targeting HUD Animation Screen Terminal](https://www.pinterest.com/pin/1109855901925837378/)

## Stack

Vanilla HTML/CSS/JS + Node 18 CLI. Paper tape only. No wallet keys.

## License

MIT

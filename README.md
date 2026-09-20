# QUIETR

**Desk 7** for [vibelancer](https://x.com) × [pump.fun](https://pump.fun) — a Solana targeting HUD that refuses the first candle.

> Don't chase the open. Wait for **silence** after the first dump. Enter the **second wave**.

![QUIETR targeting HUD](assets/quietr-hud.png)

---

## Why it exists

Most desks print the first green candle and bleed the dump.  
**QUIETR** flips that:

1. **Ignore** candle one  
2. **Arm** when the dump prints hard enough  
3. **Hold** while volume collapses and spread stays clean  
4. **Enter** only when the second leg lifts off the floor  

Less candle-one bleed. More second-leg prints. All in **SOL**.

| panel | job |
|-------|-----|
| Mint radar | live SOL pool + rug score |
| Silence gates | dump % · vol collapse · spread bps · hold bars |
| Second-leg prints | expectancy · hit · pnl in SOL |
| Vs candle-one | quietr avg vs chase-first bleed delta |

![Mint radar — SOL](assets/quietr-radar.png)

![Score vs chase bleed](assets/quietr-score.png)

---

## Mechanic

```text
01 FIRST CANDLE   → IGNORE
02 DUMP LEG       → ARM  (drop ≥ threshold)
03 SILENCE        → vol ≤ X% of dump avg + spread ok + hold N bars
04 SECOND WAVE    → enter on lift off dump floor
```

Paper tape only. No wallet keys. Calibrate on yesterday → ship rules for today.

---

## Run

```bash
npm run desk        # http://localhost:5180  · 1920×1080 HUD
npm run demo        # quietr vs chase-first contrast
npm run calibrate   # → data/next-rules.json
npm run replay
```

Desk buttons (**RUN DEMO / CALIBRATE / REPLAY**) call the same engine as the CLI (`src/engine.mjs`).

---

## Visual

Dark **biometric eye** lock (phosphor green) on a 60s loop:

- Eye sits dead center — iris spokes, scan sweep, lock brackets  
- **SOL counter** lives in the pupil (expectancy live-tween)  
- Six terminals **orbit** the eye (radar · gates · second-leg · bleed · log · rules)  
- Terminal chrome matches the eye color  
- Brands on the bar: **QUIETR** · **VIBELANCER** · **PUMP.FUN**

Ref energy: biometric eye-scan HUD / dark terminal orbit desk.

---

## Stack

Vanilla HTML/CSS/Canvas + Node 18 ESM CLI. MIT.

```
quietr/
  index.html      ← 1920 HUD
  src/engine.mjs  ← silence → second-leg logic
  src/cli.mjs
  assets/         ← desk stills
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Circuit Flow** is a browser-based puzzle game (Japanese UI) where players rotate circuit pieces to connect a power source to light bulbs. Built with React 18 (CDN) and vanilla CSS, embedded entirely in `index.html`. No build step required.

## Running and Testing

- **Play (dev):** Open `index.html` directly — uses CDN React + in-browser Babel. `index.html` remains the single source of truth; edit it.
- **Test stages:** `node test_stages.js` (or `npm test`) — validates every stage is solvable and not pre-solved at the start
- **Production build:** `npm install` once, then `npm run build` → emits `dist/index.html`: a single self-contained file with React/ReactDOM production UMD inlined and the JSX pre-compiled + minified (no CDN, no runtime Babel). Publish `dist/index.html`.

`build.js` extracts the inline `<script type="text/babel">` block, transpiles it with `@babel/preset-react` (classic runtime — relies on the global `React`), minifies with terser, and inlines the React production bundles. Never hand-edit `dist/`; rebuild instead.

## Architecture

Everything lives in `index.html` as a single self-contained file with three sections:
1. Inline `<style>` — full dark-theme CSS
2. Inline `<script type="text/babel">` — React components + game logic
3. CDN imports for React 18 and Babel (JSX compiled in-browser)

### Screen Flow

```
App (root state, localStorage persistence)
├── StageSelect — level grid with unlock/star display
└── GameScreen  — active puzzle with move counter, hint, back
```

### Game Logic

**Cell structure:** `{ type, rotation }` where type is one of `source`, `bulb`, `straight`, `l`, `t`, `cross`, `empty`.

**`getConnections(type, rotation)`** — returns the set of directions (0=N, 1=E, 2=S, 3=W) a piece outputs at a given rotation.

**`computePowered(grid)`** — BFS from the `source` cell, spreading power through cells that mutually connect (both cells must have an outlet facing each other). Returns a Set of `"row,col"` keys.

**`isSolved(grid)`** — returns true when every `bulb` cell is in the powered set.

### Stage Definition

Stages are entries in the `STAGES` array, each with:
```js
{
  id, name,           // display metadata
  grid,               // 2D array of makeCell(type, rotation) / E()
  minMoves,           // threshold for 3-star rating
}
```

To add a stage: append to `STAGES`, define the grid with `makeCell`/`E()` helpers, set `minMoves`, then verify with `node test_stages.js`.

### Persistence

Stars per stage stored in `localStorage` under key `cf_stars` as `{ [stageId]: 0|1|2|3 }`. Stage unlocking is derived at render time from this data (each stage unlocks the next on any completion).

### Scoring

| Moves | Stars |
|---|---|
| ≤ minMoves | 3 |
| ≤ minMoves × 1.5 | 2 |
| any other / hint used | 1 |

### Rendering

Each cell is a 72×72px SVG drawn directly in JSX. Powered cells glow cyan (`#00ffcc`); lit bulbs turn yellow (`#ffee44`). Rotation animates with a 0.12s CSS transition on click.

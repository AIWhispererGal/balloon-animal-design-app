# Balloon Animal Design App

A Next.js app for designing balloon animals: build a design in a 3D viewer, pick a complexity tier, and generate step-by-step twisting instructions.

## What you can do

- **Sculpt in 3D**: click a bubble to select it, drag the cyan tip to change its length, the pink dot for diameter and the gold gem to bend or turn it. Shift-click selects several bubbles.
- **Split a bubble**: use the Split menu (halves, thirds, lock pair, pinch between, or at an exact distance), or turn on split mode in the toolbar and click the spot on the bubble where you want the new twist.
- **Twist bubbles together**: select two adjacent bubbles to lock-twist them as a pair, three or more to roll them through as a bird body, or two non-adjacent bubbles to close everything between them into a locked ring.
- **Twists are selectable too**: click the small marker at any joint in 3D, or a seam row in the Build list. Select two twists and "Twist together": on one balloon, one bubble between them becomes a loop, two become a lock pair, three or more fold into a ring. On two different balloons the joints are stuck together (the classic two-pinch lock): a free-standing balloon moves so the joints meet, and the joined twist counts as a lock. A selected twist is also where "Add balloon" or "Tie in here" (Balloons tab) attaches a balloon's knot.
- **Air budget**: every balloon shows how much inflated balloon the bubbles have used and how much uninflated tail is left. Each twist squeezes a little air into the tail, so the tail in the 3D view shrinks as you build. "Inflate just enough" sets the tail so the balloon just covers the design.
- **Balloons**: add a 160, 260 or 360 in any color, tied into an existing joint or free-standing, and recolor a balloon from the viewport dock or the Build tab.
- **Blank slate**: start from one empty inflated balloon and add twists from the palette (click or drag onto the model).
- **Stability check**: unanchored twists are flagged with a one-click fix, and "Let go" shows what unravels.
- **Shopping** (`/shopping`): build a balloon recipe from a catalog of packs (brand, size, color, pack size, price), see the cost of one sculpture, and plan a purchase: pick one pack as the anchor and the planner works out how many packs of everything else to buy and how many sculptures that makes. The shopping page always opens with a recipe for the design currently open in the editor; balloons picked from the catalog (the "Catalog" tab in any balloon color picker) are priced as that exact pack, the rest are matched by size and color. Recipes save in the browser and export as JSON with price per balloon. The catalog in `src/data/balloonCatalog.json` is imported from the La Rock's listing (160 / 260 / 350-360 / 660 filters). To refresh prices: open that listing in a browser with "items per page" at maximum, save each page with Ctrl+S as "Webpage, Complete" into one folder, then run `node scripts/import-larocks.mjs <that folder>`.
- **Orientation**: the axis button in the viewport toolbar flips the sculpture upside down, turns it around, or tilts and rolls it in 90° steps, so it sits the right way up on the ground. Saved with the design.
- **Save and share**: Save keeps the design in this browser (Ctrl/Cmd+S). File downloads it as `.twistcraft.json`; New / open lists saved designs and imports files. Export renders a PNG instruction card.

## Stack

- Next.js 16 / React 19 / TypeScript
- Three.js for the 3D balloon viewer
- Tailwind CSS 4

There is no server or database. All the modeling runs in the browser, designs are saved in the browser's local storage, and a design can be downloaded as a `.twistcraft.json` file and imported on another device.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
src/
  app/          page, layout, icon
  components/   editor, 3D viewer, step deck, modals, design library
  lib/          balloon geometry, air budget, edit operations, presets, step generation, storage
  types/        shared balloon types
```

Key modules:

- `lib/balloonLayout.ts` solves bubble positions, joints and twist stability.
- `lib/balloonAir.ts` is the single air model (inflated length, bubbles consumed, tail squeezed away).
- `lib/designEdits.ts` holds the pure edit operations (split, twist together, insert, delete, reorder) with index-safe remapping.
- `lib/stepGenerator.ts` compiles the step-by-step instructions from the layout and air model.
- `lib/designStorage.ts` saves projects to local storage and reads/writes the JSON file format.
- `lib/recipeMath.ts` costs a recipe and plans packs; `data/balloonCatalog.json` is the price list it reads.

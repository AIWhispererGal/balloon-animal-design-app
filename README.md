# Balloon Animal Design App

A Next.js app for designing balloon animals: build a design in a 3D viewer, pick a complexity tier, and generate step-by-step twisting instructions.

## What you can do

- **Design from a photo or a description (AI)**: New / open takes a description, a reference image, or both. With an Anthropic API key entered in the "AI design engine" panel, the default "Body plan" method asks the model only what a vision model is good at: which body plan fits (built-in plans and the ones you saved), how long each part is, and which latex colors and gauges. The builder then makes the geometry, so the result always holds; the answer is clamped to each part's range and scaled down if a balloon would run over length. The "Freeform geometry" method is the older route: the model studies the picture and returns three buildable tiers in the app's own bubble schema (balloons, bubbles, twist types, lengths, bends, lock-backs, tie-ins); the layout engine validates the answer, equalises lock pairs, scales over-length balloons, auto-locks anything that would unravel, and links each balloon to the cheapest matching catalog pack. The key is stored only in your browser (`twistcraft.ai.v1` in localStorage) and calls go straight from the browser to the Claude API, so you pay per generation on your own account. Pick the model in the same panel: Sonnet 5.5 (default, about 2¢ a design), Haiku 5.5 (about 0.1¢, rougher geometry) or Opus 5.5 (about 4¢). Without a key the app falls back to keyword templates and the hand-made dog, sword and flower presets.
- **Build from a body plan**: New / open also has the way a twister designs. Pick a body plan (dog, dachshund with paws, cutlass, broadsword, daisy; all derived from the hand-made presets), set how long each part is with one slider per part (a lock pair or a leg-with-toes group resizes together, pinches stay put), pick each balloon's color and gauge, watch the air use per balloon and the live preview, and build. The twists, bends and locks come from the plan, so the result always holds. "Save as plan" keeps the open design as a body plan in this browser, for one- and two-balloon recipes; saved plans appear beside the built-in ones and can be deleted.
- **Reference photo**: the "Reference" button above the 3D view (or dropping an image onto it) pins a photo to sculpt against. It sits in a corner of the viewport, or lays translucently over the whole view so the model can be lined up on it, with opacity, mirror and size controls. A design generated from a photo keeps that photo as its reference. The photo is saved with the design (as a small JPEG) and travels with the `.twistcraft.json` file.
- **Sculpt in 3D**: click a bubble to select it, then drag the bubble itself to bend and turn it, or use the handles: the cyan tip changes length, the pink dot diameter, the gold gem bends. Shift-click selects several bubbles.
- **Split a bubble**: use the Split menu (halves, thirds, lock pair, pinch between, or at an exact distance), or turn on split mode in the toolbar and click the spot on the bubble where you want the new twist.
- **Twist bubbles together**: select two adjacent bubbles to lock-twist them as a pair, three or more to roll them through as a bird body, or two non-adjacent bubbles to close everything between them into a locked ring.
- **Twists are selectable too**: click the small marker at any joint in 3D, or a seam row in the Build list. Select two twists and "Twist together": on one balloon, one bubble between them becomes a loop, two become a lock pair, three or more fold into a ring. On two different balloons the joints are stuck together (the classic two-pinch lock): a free-standing balloon moves so the joints meet, and the joined twist counts as a lock. A selected twist is also where "Add balloon" or "Tie in here" (Balloons tab) attaches a balloon's knot.
- **Air budget**: every balloon shows how much inflated balloon the bubbles have used and how much uninflated tail is left. Each twist squeezes a little air into the tail, so the tail in the 3D view shrinks as you build. "Inflate just enough" sets the tail so the balloon just covers the design.
- **Balloons**: add a 160, 260 or 360 in any color, tied into an existing joint or free-standing, and recolor a balloon from the viewport dock or the Build tab. Free-standing balloons are stacked under the sculpture with room for their legs and loops, and the Balloons tab has nudge buttons to move one out of the way.
- **Blank slate**: start from one empty inflated balloon and add twists from the palette (click or drag onto the model).
- **Stability check**: unanchored twists are flagged with a one-click fix, and "Let go" shows what unravels.
- **Shopping** (`/shopping`): build a balloon recipe from a catalog of packs (brand, size, color, pack size, price), see the cost of one sculpture, and plan a purchase: pick one pack as the anchor and the planner works out how many packs of everything else to buy and how many sculptures that makes. The shopping page always opens with a recipe for the design currently open in the editor; balloons picked from the catalog (the "Catalog" tab in any balloon color picker) are priced as that exact pack, the rest are matched by size and color. "Shopping list for an event" takes the number of sculptures you need and rounds every line up to whole packs. Recipes save in the browser and export as JSON with price per balloon. The catalog in `src/data/balloonCatalog.json` is imported from the La Rock's listing (160 / 260 / 350-360 / 660 filters). To refresh prices: open that listing in a browser with "items per page" at maximum, save each page with Ctrl+S as "Webpage, Complete" into one folder, then run `node scripts/import-larocks.mjs <that folder>`.
- **Orientation**: the axis button in the viewport toolbar flips the sculpture upside down, turns it around, or tilts and rolls it in 90° steps, so it sits the right way up on the ground. Saved with the design.
- **Save and share**: the open design (all tiers, orientation included) is remembered across the shopping page and reloads. Save keeps the design in this browser (Ctrl/Cmd+S). File downloads it as `.twistcraft.json`; New / open lists saved designs and imports files. Export renders a PNG instruction card.

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
- `lib/aiDesigner.ts` is the AI engine: the plan-based call (the model picks a body plan and proportions, validated and built through `lib/archetypes.ts`) and the freeform call (JSON schema and prompt for whole bubble sequences, with the validator that turns the answer into designs); `lib/aiSettings.ts` keeps the key and model.
- `lib/archetypes.ts` turns a design into a body plan (groups bubbles into parts a twister would name), stores saved plans, and builds a design from a plan with chosen part lengths, colors and gauges; `components/ArchetypeBuilder.tsx` is its panel.
- `lib/referenceImage.ts` shrinks a photo into the small data URL a reference is stored as; `components/ReferenceImagePanel.tsx` shows it over the viewer.
- `lib/designStorage.ts` saves projects to local storage, remembers the open editor session, and reads/writes the JSON file format.
- `lib/recipeMath.ts` costs a recipe and plans packs; `data/balloonCatalog.json` is the price list it reads.

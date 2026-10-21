# Balloon Animal Design App

A Next.js app for designing balloon animals: build a design in a 3D viewer, pick a complexity tier, and generate step-by-step twisting instructions.

## What you can do

- **Sculpt in 3D**: click a bubble to select it, drag the cyan tip to change its length, the pink dot for diameter and the gold gem to bend or turn it. Shift-click selects several bubbles.
- **Split a bubble**: use the Split menu (halves, thirds, lock pair, pinch between, or at an exact distance), or turn on split mode in the toolbar and click the spot on the bubble where you want the new twist.
- **Twist bubbles together**: select two adjacent bubbles to lock-twist them as a pair, three or more to roll them through as a bird body, or two non-adjacent bubbles to lock the later one back into the earlier joint.
- **Air budget**: every balloon shows how much inflated balloon the bubbles have used and how much uninflated tail is left. Each twist squeezes a little air into the tail, so the tail in the 3D view shrinks as you build. "Inflate just enough" sets the tail so the balloon just covers the design.
- **Balloons**: add a 160, 260 or 360 in any color, tied into an existing joint or free-standing, and recolor a balloon from the viewport dock or the Build tab.
- **Blank slate**: start from one empty inflated balloon and add twists from the palette (click or drag onto the model).
- **Stability check**: unanchored twists are flagged with a one-click fix, and "Let go" shows what unravels.

## Stack

- Next.js 16 / React 19 / TypeScript
- Three.js for the 3D balloon viewer
- Tailwind CSS 4
- Drizzle ORM with PostgreSQL

## Getting started

```bash
npm install
cp .env.example .env   # then set DATABASE_URL
npm run dev
```

Open http://localhost:3000.

### Database

The app expects a PostgreSQL connection string in `DATABASE_URL`. To push the schema:

```bash
npx drizzle-kit push
```

`GET /api/health` returns `{ ok: true }` once the database is reachable.

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
  app/          routes, layout, API handlers (designs, health)
  components/   editor, 3D viewer, step deck, modals
  lib/          balloon geometry, air budget, edit operations, presets, step generation
  db/           Drizzle client (lazy; connects on first query) and schema
  types/        shared balloon types
```

Key modules:

- `lib/balloonLayout.ts` solves bubble positions, joints and twist stability.
- `lib/balloonAir.ts` is the single air model (inflated length, bubbles consumed, tail squeezed away).
- `lib/designEdits.ts` holds the pure edit operations (split, twist together, insert, delete, reorder) with index-safe remapping.
- `lib/stepGenerator.ts` compiles the step-by-step instructions from the layout and air model.

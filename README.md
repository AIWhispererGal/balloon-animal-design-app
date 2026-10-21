# Balloon Animal Design App

A Next.js app for designing balloon animals: build a design in a 3D viewer, pick a complexity tier, and generate step-by-step twisting instructions.

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
  lib/          balloon geometry, presets, step generation
  db/           Drizzle client and schema
  types/        shared balloon types
```

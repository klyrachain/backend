# KLYRA Admin Backend

**Fastify** API (TypeScript): routes live in `src/routes/register.ts`; handlers in `src/controllers/`.

## Setup

1. Copy `.env.example` to `.env` and set `PORT` (optional locally; hosts usually inject `PORT`).

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT`   | No       | Listen port (default `4001`). Production hosts (Vercel, Railway, …) normally set `PORT` for you. |

## Scripts

- `pnpm dev` – Run with hot reload (tsx watch)
- `pnpm build` – Compile TypeScript to `dist/`
- `pnpm start` – Run compiled app (`node dist/index.js`)

## API

- **GET** `/` – Service metadata (JSON)
- **GET** `/api/health` – Health check. Returns `{ status, timestamp, uptime }`.

## Deploying (why Vercel might hang or never respond)

Requests that **never return** (browser spinner, `curl` timeout with **0 bytes**) are almost always **wrong project layout on Vercel**, not “Fastify vs Express.”

1. **Monorepo root directory**  
   If this repo is `KLYRA-ADMIN/` and the API lives under `backend/`, the Vercel project **Root Directory** must be **`backend`**.  
   If Root Directory is the repo root, Vercel will **not** see `backend/src/index.ts` as the Fastify entrypoint and the deployment will not behave like a working API.

2. **Official Fastify on Vercel**  
   Vercel expects a Fastify entry at one of: `src/index.ts`, `src/app.ts`, `src/server.ts`, etc. (see [Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify)). Use **Vercel CLI ≥ 48.6.0** and, for local parity, `vercel dev` from the **`backend`** folder.

3. **Easier alternative: long‑running Node hosts**  
   If you want zero Vercel-specific behavior, deploy the same app to **Railway**, **Render**, **Fly.io**, or a small VPS: run `pnpm build` and `pnpm start`, set env vars, and map `PORT`. That matches `package.json`’s `start` script and avoids serverless constraints.

## Project structure

```
src/
├── config/       # Env and app config
├── controllers/  # Request handlers
├── services/     # Business logic
├── routes/       # register.ts — pure Fastify route registration
├── app.ts        # Fastify + CORS + root GET
└── index.ts      # listen()
```

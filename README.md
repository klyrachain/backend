# KLYRA Admin Backend

Express.js API backend (TypeScript).

## Setup

1. Copy `.env.example` to `.env` and set `PORT`:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

## Environment

| Variable | Required | Description        |
|----------|----------|--------------------|
| `PORT`   | Yes      | Server port (1–65535). No fallback. |

## Scripts

- `pnpm dev` – Run with hot reload (tsx watch)
- `pnpm build` – Compile TypeScript to `dist/`
- `pnpm start` – Run compiled app (`node dist/index.js`)

## API

- **GET** `/api/health` – Health check. Returns `{ status, timestamp, uptime }`.

## Project structure

```
src/
├── config/       # Env and app config
├── controllers/  # Request handlers
├── services/     # Business logic
├── routes/       # Route definitions
├── app.ts        # Express app
└── index.ts      # Entry point
```

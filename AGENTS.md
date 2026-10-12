<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Hearth

A self-hosted home dashboard: Next.js 16 App Router, Better Auth, Drizzle on Postgres (or embedded PGlite), Arc UI, Paper Shaders, and Motion. See `README.md` for the architecture map.

## Rules

- **Integrations implement `Provider`** (`src/lib/integrations/types.ts`) and map onto `Device` and `DeviceCommand` (`src/lib/devices/types.ts`). UI code never imports an integration directly.
- **Errors shown to people are `IntegrationError`s.** Anything else is logged and replaced with a generic message by `readableError` in `src/lib/home.ts`.
- **Secrets are sealed** with `seal` / `unseal` (`src/lib/crypto.ts`) before they reach the database, and never sent to the browser. `publicConfig` is the only path from a stored config to a client component.
- **Every page, route handler, and server action checks the session itself.** `src/proxy.ts` only checks that a cookie exists.
- **Database is Postgres**: `DATABASE_URL` for a real server (Neon, Supabase), otherwise embedded PGlite in `DATABASE_PATH`. Code only against Drizzle's query API so both keep working; never use driver-specific calls.
- **Schema changes**: edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit the new file under `drizzle/`. Migrations apply on startup.
- **Arc components live in `src/components/arc`** and are installed with `npx shadcn@latest add @uiarc/<name>`. Do not edit them; compose them. `components.json` must keep `"style": "new-york"`: Base UI styles make the shadcn CLI rewrite Arc's Radix `asChild` into `render` and break it.
- **React Bits code in `src/components/reactbits` is vendored** and excluded from lint.
- **Glass**: use `Glass` / `glassClass` (`src/components/glass`) for surfaces, and `glassSheetClass` for layers that position themselves (dialogs, drawers).
- **Dashboard layout is data** (`src/lib/dashboard/layout.ts`). A tile is `{ id, kind, link, size, ... }`; `resolveLayout` must never add tiles, because the dashboard holds only what the person put there. New tile kinds need an entry in `SIZE_OPTIONS`, `KIND_INFO` (`catalog.ts`), and the `tileSchema` in `actions.ts`, and a size must keep cells square: the grid derives row height from column width.
- **Sensitive commands** (unlocking, opening a garage door, door, or gate; see `isSensitive`) go through `HoldToConfirm` in the UI and are refused by the assistant and scenes.
- **Assistant providers** live in `src/lib/assistant`. Claude goes through `@anthropic-ai/sdk`; the others use plain fetch. OpenAI and xAI use the Responses API (OpenAI's current models only call tools there); Gemini, Muse, and custom servers use Chat Completions and must echo assistant messages verbatim. Never send Muse a `tool_choice`. Every tool call goes through `runCommand`, so the assistant can only touch the signed-in person's devices.
- Arc's design rules apply: semantic tokens, weights 400 and 500, sentence case, no em dashes, a reduced motion branch for every animation, and a server-safe first render. Full rules: https://uiarc.dev/r/skills/arc/INSTRUCTIONS.md

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

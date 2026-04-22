# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev        # Start Next.js dev server
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint

# Database
npm run seed       # Run src/lib/seed.ts to create tables and seed data
```

No test framework is configured.

## Environment Variables

Copy `.env.local` with:
- `OPENAI_API_KEY` — for GPT-4.1-nano and text-embedding-3-small
- `AUTH_SECRET` — NextAuth JWT signing key
- `POSTGRES_URL` — Supabase pooled connection (pgBouncer)
- `POSTGRES_URL_NON_POOLING` — direct connection, used for embeddings/seeding
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Seed credentials for local dev: `admin@tcd.ie` / `adminadmin`

## Architecture

### Multi-Agent AI Pipeline

The core logic lives in [src/app/api/chat/route.ts](src/app/api/chat/route.ts) and uses a two-step agent pattern:

1. **Routing Agent** — `generateObject()` classifies the user message into one of three query types (SQL, Vector, Other) using a Zod schema from [src/lib/schema.ts](src/lib/schema.ts) and the routing prompt from [src/lib/prompt.ts](src/lib/prompt.ts).

2. **Interpret Agent** — Executes the appropriate path:
   - **SQL**: Calls `queryStructuredData()` in [src/lib/utils.ts](src/lib/utils.ts) → runs generated SQL against Vercel Postgres → `streamText()` generates a chart (bar/line/pie) with structured data
   - **Vector**: Calls `queryVectorEmbeddingData()` → generates an OpenAI embedding → Supabase RPC `match_documents()` for pgvector similarity search
   - **Other**: Direct `streamText()` for conversational replies

   Streaming uses Vercel AI SDK's `Output.object()` for structured output and `.toDataStreamResponse()` to the client.

### Database

Two Postgres clients are used:
- **Vercel Postgres** (`@vercel/postgres`) — for SQL queries against `tiktok_sales`
- **Supabase JS client** (`@supabase/supabase-js`) — for vector similarity RPC calls

The `tiktok_sales` table has a `bio_embedding` pgvector column populated by `seedEmbeddings()` in [src/lib/seed.ts](src/lib/seed.ts) (disabled by default due to cost). Schema is created in `seed.ts` with `CREATE TABLE IF NOT EXISTS` — no formal migration tool.

### Authentication

NextAuth v5 (beta) with Credentials provider:
- [auth.ts](auth.ts) — main config, `signIn`/`signOut` exports
- [auth.config.ts](auth.config.ts) — authorized callback and page routes
- [middleware.ts](middleware.ts) — protects all routes; redirects unauthenticated users to `/login`
- [src/lib/actions.ts](src/lib/actions.ts) — `authenticate()` server action used by the login form
- [src/lib/db.ts](src/lib/db.ts) — `getUser(email)` queries the `users` table

### UI

Material UI (MUI v7) + TailwindCSS. Key components:
- [src/components/chat.tsx](src/components/chat.tsx) — `useChat()` hook wires the UI to `/api/chat`; listens for custom `submitQuestion` events to inject sample questions
- [src/components/bubble_assistant.tsx](src/components/bubble_assistant.tsx) — renders AI responses, parses streamed structured data, renders charts
- [src/lib/config.ts](src/lib/config.ts) — model name (`gpt-4.1-nano`) and sample questions array

### Path Aliases

```
@/*    → src/*
@/ui   → src/app/components/*  (legacy alias)
@/lib  → src/app/lib/*         (legacy alias)
```

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

# Evaluation (LangSmith)
npm run eval       # Run scripts/eval/run.ts — seeds dataset on first run, then evaluates the chat pipeline
```

No test framework is configured. The `eval` script is the closest thing to a regression suite — it runs the full pipeline against a fixed dataset and scores routing/chart/SQL/answer quality via LangSmith.

## Environment Variables

`.env.local` must contain:
- `OPENAI_API_KEY` — for the chat model and `text-embedding-3-small`
- `AUTH_SECRET` — NextAuth JWT signing key
- `POSTGRES_URL` — Supabase pooled connection (pgBouncer)
- `POSTGRES_URL_NON_POOLING` — direct connection, used for embeddings/seeding
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LANGSMITH_TRACING`, `LANGSMITH_ENDPOINT`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` — read by `new Client()` and the SDK wrapper; required for tracing and for `npm run eval`
- `HTTP_PROXY` — optional; if set, [src/lib/proxy.ts](src/lib/proxy.ts) installs an undici `ProxyAgent` as the global dispatcher (needed for OpenAI/LangSmith calls behind a corporate proxy)

Model name is set in [src/lib/config.ts](src/lib/config.ts) as `appConfig.model` — change it there, not inline.

Seed credentials for local dev: `admin@tcd.ie` / `adminadmin`

## Architecture

### Chat pipeline — LangGraph orchestration over Vercel AI SDK

The pipeline is split across three files. Understanding the split is important before editing:

- [src/app/api/chat/route.ts](src/app/api/chat/route.ts) — thin HTTP handler. Parses messages, wraps `runChatPipelineCore()` in `traceable()` so the whole run shows up as one LangSmith trace, then returns `interpretStream.toUIMessageStreamResponse()`. Uses `next/server`'s `after()` to flush pending traces.
- [src/lib/chat-graph.ts](src/lib/chat-graph.ts) — the actual orchestration: a `StateGraph` from `@langchain/langgraph` with named nodes (`routing_agent`, `query_sql`, `interpret_sql`, `validate`, `fix`, `fallback`, `embed_query`, `vector_search`, `interpret_vector`, `interpret_other`, `stream`). The graph compiles to `chatGraph`.
- [src/lib/chat-pipeline.ts](src/lib/chat-pipeline.ts) — the agent primitives the graph calls (`proceedRoutingAgent`, `proceedInterpretAgent`), plus `runChatPipelineCore()` which invokes the graph. Also exports the LangSmith-wrapped `generateText`/`streamText` (`wrapAISDK` from `langsmith/experimental/vercel`) — **always import these from `chat-pipeline.ts`, not from `ai`**, or the calls won't be traced.

**Three lanes branch off `routing_agent`:**
1. **SQL** → `query_sql` → `interpret_sql` → `validate` → (`stream` | `fix` → `validate` | `fallback` → `stream`)
2. **Vector** → `embed_query` → `vector_search` → `interpret_vector` → `stream`
3. **Other** → `interpret_other` → `stream`

`embed_query` is currently a no-op stub — the embedding call still lives inside `queryVectorEmbeddingData()` in [src/lib/utils.ts](src/lib/utils.ts). The node exists so a future change can split it out and have it show up as its own span in traces.

**Chart validation loop (SQL lane only).** The `validate` node consumes the interpret stream, parses the structured output, and calls `validateChartShape()` from [src/lib/chart-validation.ts](src/lib/chart-validation.ts). On failure it routes to `fix` (which re-runs the interpret agent with a correction prompt) up to `appConfig.chartMaxAttempts` times; after that it routes to `fallback`, which re-runs the interpret agent in `OTHER` mode with a textual summary of the data. Important: the `validate` node calls `consumeStream()`, so by the time the SQL lane reaches `stream` the stream has already been drained — the UI replays from the resolved structured output, not the live token stream.

**State annotation.** `ChatStateAnnotation` in `chat-graph.ts` carries the model, question, history, routing result, query result, interpret stream, attempt counter, and last validation error. The interpret stream is non-serializable, so **do not attach a checkpointer to this graph** (commented in code).

### Agents

Both agents use Vercel AI SDK with Zod-typed structured output:

- **Routing agent** — `generateText` + `Output.object({ schema: getRoutingAgentSchema() })`. Returns `{ mode, reasoning, sql?, semanticQuery?, chartType? }`. Schemas in [src/lib/schema.ts](src/lib/schema.ts), prompts in [src/lib/prompt.ts](src/lib/prompt.ts).
- **Interpret agent** — `streamText` + `experimental_output: Output.object(...)`. Schema and system prompt are selected by `routingAgentResult.mode` (chart / vector / general). When `fix` re-runs it, the prompt includes a `validationError` correction block.

### Database

Two Postgres clients are used:
- **Vercel Postgres** (`@vercel/postgres`) — for SQL queries against `tiktok_sales`
- **Supabase JS client** (`@supabase/supabase-js`) — for vector similarity RPC calls (`match_documents`)

`tiktok_sales` has a `bio_embedding` pgvector column populated by `seedEmbeddings()` in [src/lib/seed.ts](src/lib/seed.ts) (disabled by default due to cost). Schema is created with `CREATE TABLE IF NOT EXISTS` — no formal migration tool.

### Evaluation framework

[scripts/eval/](scripts/eval/) is a LangSmith eval harness, run with `npm run eval`:

- [scripts/eval/run.ts](scripts/eval/run.ts) — entry point. `ensureDataset()` creates the LangSmith dataset `nextjs-ai-chat-pipeline` on first run (idempotent). The `target` function calls `runChatPipelineCore()`, drains the stream, and returns `{ mode, sql, chartType, formattedData, answer }`.
- [scripts/eval/dataset.ts](scripts/eval/dataset.ts) — the fixture: `(question, expectedMode, expectedChartType?, referenceSql?, referenceAnswer?)` tuples covering general/bar/line/pie/vector cases. Edit here to add cases.
- [scripts/eval/evaluators.ts](scripts/eval/evaluators.ts) — five evaluators: exact-match for `routing_mode` and `chart_type`; programmatic check for `chart_shape` (reuses `validateChartShape`); LLM-as-judge for `sql_correctness` and `answer_quality`.
- [scripts/eval/load-env.ts](scripts/eval/load-env.ts) — imports `dotenv/config` from `.env.local` before anything else, since `tsx` runs the script outside Next.js.

The eval runs the **same** `runChatPipelineCore()` the production route uses, so changes to the graph are exercised end-to-end.

### Authentication

NextAuth v5 (beta) with Credentials provider:
- [auth.ts](auth.ts) — main config, `signIn`/`signOut` exports
- [auth.config.ts](auth.config.ts) — authorized callback and page routes
- [middleware.ts](middleware.ts) — protects all routes; redirects unauthenticated users to `/login`
- [src/lib/actions.ts](src/lib/actions.ts) — `authenticate()` server action used by the login form
- [src/lib/db.ts](src/lib/db.ts) — `getUser(email)` queries the `users` table

### UI

Material UI (MUI v7) + TailwindCSS. Key components:
- [src/components/chat.tsx](src/components/chat.tsx) — `useChat()` wires the UI to `/api/chat`; listens for custom `submitQuestion` events to inject sample questions
- [src/components/bubble_assistant.tsx](src/components/bubble_assistant.tsx) — renders AI responses, parses streamed structured data, renders charts via `@mui/x-charts`
- [src/lib/config.ts](src/lib/config.ts) — `appConfig` (model, theme color, chart retry budget) and `sampleQs`

### Path aliases (from [tsconfig.json](tsconfig.json))

```
@/*       → src/*           (primary alias, used by all current code)
@/auth    → auth.ts
@/public  → public/*
@/ui      → src/app/components/*   (legacy, unused)
@/lib     → src/app/lib/*          (legacy, unused — current code is at src/lib/*)
```

Prefer `@/*` for new imports; the `@/ui` and `@/lib` aliases point to paths that no longer exist and are kept only for historical compatibility.

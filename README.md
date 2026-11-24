# DocuMind: RAG document chat (Next.js + Supabase pgvector + Gemini)

![Next.js](https://img.shields.io/badge/Next.js-App_Router-black) ![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E) ![Gemini](https://img.shields.io/badge/Google_Gemini-embeddings_+_chat-8E75B2) ![Stripe](https://img.shields.io/badge/Stripe-subscriptions-008CDD) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

Upload PDFs, then chat with them. DocuMind extracts and chunks the text, stores Gemini embeddings in
Supabase **pgvector** (HNSW, cosine), retrieves the most relevant chunks for each question, and streams
an answer grounded in those chunks next to the PDF. A Stripe layer shows how to gate usage by plan.

<!-- TODO: add a screenshot of /hub/[id] (PDF + chat split view) -->

## How it works

```
Upload PDF ─► server action processPDF
              ├─ Supabase Storage (file)
              ├─ LangChain WebPDFLoader + RecursiveCharacterTextSplitter (1000 / 200 overlap)
              ├─ gemini-embedding-001 @ 768 dims per chunk (src/lib/embeddings.ts, shared with the query side)
              └─ INSERT documents + embeddings (pgvector, HNSW index)

Question ─► /api/chat (streaming, Vercel AI SDK)
              ├─ embed question ─► match_embeddings(filter_document_id) — top-k chunks for that document
              └─ Gemini chat with retrieved context ─► streamed answer in ChatWorkspace
```

## Features

- PDF upload, document library and status badges (`/`, `/documents`)
- Split-screen workspace: PDF viewer + streaming chat (`/hub/[id]`)
- Stripe Checkout + webhook to record subscription tier; middleware enforces plan limits (`/pricing`)
- `/api-reference` and `/settings` are **UI mock-ups** (no live public API, no persisted settings yet)

## Run locally

1. Create a Supabase project and run `supabase_schema.sql` (and `supabase_schema_stripe.sql` for billing) in the SQL editor.
   Then run `supabase_rls.sql` so Row Level Security is on and the anon key cannot read or write table data. The app itself uses `SUPABASE_SERVICE_ROLE_KEY` on the server, which bypasses RLS.
   Upgrading a database created with the old `VECTOR(3072)` schema? Run `supabase_migration_768.sql`, then re-upload your PDFs.
2. Configure and start:

```bash
npm install
cp .env.template .env.local   # fill in the values below
npm run dev
```

| Variable | |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only (actions / route handlers) |
| `GEMINI_API_KEY` | embeddings + chat |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_SITE_URL` | optional, for `/pricing` |

## Project structure

```
src/app/actions.ts               processPDF, fetchDocuments, deleteDocument
src/app/api/chat/route.ts        retrieval + streaming chat
src/lib/embeddings.ts            embedding model + dimension (single source of truth)
src/app/api/stripe/*             checkout + webhook
src/app/hub/[id]/ChatWorkspace.tsx
src/middleware.ts                route guard / plan limits
supabase_schema*.sql             tables, pgvector index, billing tables
supabase_rls.sql                 row level security and privilege lockdown
```

## Roadmap

- Row Level Security per user and per-user document scoping
- Tests for chunking and retrieval; CI workflow
- Clickable page citations that jump the PDF viewer to the cited page

## License

MIT © Ahmed Elbashier

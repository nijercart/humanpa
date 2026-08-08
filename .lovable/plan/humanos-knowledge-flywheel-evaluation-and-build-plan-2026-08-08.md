# HumanOS knowledge flywheel — evaluation and build plan

## How your diagram compares to what HumanOS does today

Confirmed by reading the current pipeline (`createNeed` → `runResearch`):


| Diagram stage                       | Today                                             | Gap                                                          |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| User problem                        | Yes — free-text need, saved per user              | —                                                            |
| Intent classifier                   | No                                                | Every need is treated the same; no domain/urgency routing    |
| Semantic search over past knowledge | No                                                | Nothing is ever reused                                       |
| Knowledge found → existing research | No                                                | Two people asking the same thing burn two full research runs |
| Web search → Firecrawl              | Yes — agentic `web_search` tool loop              | —                                                            |
| Content extraction                  | Partial — only search snippets, no page scrape    | Answers rest on ~600-char snippets                           |
| Evidence store                      | Partial — `need_sources` rows, scoped to one need | Not searchable, not shared                                   |
| RAG / reasoning                     | No retrieval — pure fresh synthesis each time     | —                                                            |
| HumanOS answer                      | Yes — options + action plan                       | —                                                            |
| Save research                       | Yes, per need                                     | Not fed back as knowledge                                    |
| Knowledge flywheel                  | No                                                | The loop is open, not closed                                 |


Verdict: the architecture is sound and worth building. The right shape here is a *cache-and-augment* flywheel, not a hard either/or branch — reuse stored evidence when it is fresh and relevant, and still top it up with live search when coverage is thin. Given the 2-researches-per-day limit, a cache hit should ideally not consume quota, which is the biggest user-facing win.

## What gets built

```text
need → classify (domain, locale, freshness window)
     → embed → semantic search over evidence store
     → hits?  reuse passages ──┐
     → thin?  Firecrawl search + scrape → extract → embed → store ──┤
                                                                    ▼
                                              RAG synthesis (cited)
                                                        │
                                       answer + save evidence back
```

### 1. Evidence store (shared knowledge base)

- Enable `pgvector`.
- `knowledge_documents`: url (unique), title, domain, is_official, fetched_at, language, raw content.
- `knowledge_chunks`: document_id, chunk text, embedding, position.
- `need_knowledge`: which chunks answered which need (attribution + reuse stats).
- Documents/chunks are global, read-only to authenticated users, written only through the server (service role). No user text is stored in the shared store — only public web content.

### 2. Intent classifier

Fast model call that returns `{ domain, locale, freshness_days, needs_live_data }`. Stored on `needs`. Drives freshness policy: prices/deadlines/laws force a live pass, evergreen topics can be answered from cache.

### 3. Semantic retrieval

Embed the restated problem, `match_knowledge_chunks(query_embedding, count, max_age_days)` via cosine distance, filtered by locale and freshness. Score the hit set for coverage.

### 4. Ingestion (only when coverage is thin)

Firecrawl search as today, then Firecrawl scrape of the top results for full markdown, chunked ~1000 chars with overlap, embedded, upserted by URL so repeat URLs re-use the document row.

### 5. RAG synthesis

Feed retrieved chunks (with URLs) as grounded context to the existing options/steps synthesis. Existing language rule and JSON normalisation stay as-is. Every option/step cites source URLs already present in the context.

### 6. Quota + flywheel

- Cache-only answers do not insert a `research_runs` row → no quota consumed.
- Any run touching live search consumes quota exactly as today.
- Each run writes new evidence back, so the store gets denser over time.
- &nbsp;

## Step order

1. Migration: pgvector, `knowledge_documents`, `knowledge_chunks`, `need_knowledge`, match function, grants + RLS. Add `intent` columns to `needs`.
2. `src/lib/embeddings.server.ts` — Lovable AI embeddings helper (batching, chunking).
3. `src/lib/intent.server.ts` — classifier.
4. `src/lib/knowledge.server.ts` — retrieve, coverage score, ingest (Firecrawl scrape → chunk → embed → upsert).
5. Rewire `researchNeed` in `humanos.server.ts` to retrieve-then-augment, returning `{ reusedSources, freshSources, usedLiveSearch }`.
6. `runResearch` in `needs.functions.ts`: quota only when `usedLiveSearch`; persist `need_knowledge` links.
7. UI provenance and quota copy.
8. Verify: run a need twice, second run answers from cache, no quota consumed, sources still cited.

## Technical notes

- Embeddings: `google/gemini-embedding-001` (3072 dims) via the AI Gateway from server code only; HNSW index on a `halfvec(3072)` cast.
- Firecrawl calls stay on the existing gateway-backed connector path in `web-search.server.ts`.
- Chunk ingestion is capped per run (e.g. 8 pages) to keep latency and credit use predictable.
- All new AI/Firecrawl work runs inside `createServerFn` handlers; no keys reach the browser.
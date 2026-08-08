import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { chunkText, embedOne, embedTexts } from "./embeddings.server";
import { domainOf, looksOfficial, scrapePage, type WebResult } from "./web-search.server";

export type KnowledgePassage = {
  chunkId: string;
  documentId: string;
  content: string;
  url: string;
  title: string;
  domain: string;
  isOfficial: boolean;
  publishedDate: string | null;
  fetchedAt: string;
  similarity: number;
};

/** How many distinct documents count as "we already know enough". */
const COVERAGE_DOCS = 3;
const COVERAGE_SIMILARITY = 0.62;

/** Semantic search over everything HumanOS has already read. */
export async function retrieveKnowledge(
  query: string,
  opts: { maxAgeDays?: number | null; limit?: number } = {},
): Promise<KnowledgePassage[]> {
  try {
    const embedding = await embedOne(query);
    const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
      query_embedding: embedding as unknown as string,
      match_count: opts.limit ?? 14,
      max_age_days: opts.maxAgeDays ?? undefined,
      min_similarity: 0.35,
    });
    if (error) {
      console.error("Knowledge retrieval failed:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      chunkId: row.chunk_id as string,
      documentId: row.document_id as string,
      content: row.content as string,
      url: row.url as string,
      title: row.title as string,
      domain: row.domain as string,
      isOfficial: row.is_official as boolean,
      publishedDate: (row.published_date as string | null) ?? null,
      fetchedAt: row.fetched_at as string,
      similarity: Number(row.similarity ?? 0),
    }));
  } catch (error) {
    console.error("Knowledge retrieval failed:", error);
    return [];
  }
}

/** Do the retrieved passages actually cover the question, or do we need the live web? */
export function hasCoverage(passages: KnowledgePassage[]): boolean {
  const strong = passages.filter((p) => p.similarity >= COVERAGE_SIMILARITY);
  const docs = new Set(strong.map((p) => p.documentId));
  return docs.size >= COVERAGE_DOCS;
}

/** Scrape, chunk, embed and store fresh pages so the next person doesn't pay for them. */
export async function ingestResults(
  results: WebResult[],
  opts: { maxPages?: number; language?: string } = {},
): Promise<number> {
  const pages = results.slice(0, opts.maxPages ?? 8);
  let stored = 0;

  for (const result of pages) {
    try {
      const text = await scrapePage(result.url);
      const body = text || result.snippet;
      const chunks = chunkText(body);
      if (!chunks.length) continue;

      const { data: doc, error: docError } = await supabaseAdmin
        .from("knowledge_documents")
        .upsert(
          {
            url: result.url,
            title: result.title || domainOf(result.url),
            domain: result.domain || domainOf(result.url),
            is_official: result.isOfficial || looksOfficial(result.url),
            language: opts.language ?? null,
            content: body.slice(0, 40000),
            published_date: result.publishedDate,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "url" },
        )
        .select("id")
        .single();
      if (docError || !doc) {
        console.error("Could not store document:", docError?.message);
        continue;
      }

      // Replace old passages for this URL so refreshed pages don't leave stale text behind.
      await supabaseAdmin.from("knowledge_chunks").delete().eq("document_id", doc.id);

      const capped = chunks.slice(0, 40);
      const vectors = await embedTexts(capped);
      const rows = capped
        .map((content, index) => ({
          document_id: doc.id as string,
          position: index,
          content,
          embedding: vectors[index] as unknown as string,
        }))
        .filter((row) => Array.isArray(row.embedding) && (row.embedding as unknown as number[]).length);

      if (!rows.length) continue;
      const { error: chunkError } = await supabaseAdmin.from("knowledge_chunks").insert(rows);
      if (chunkError) {
        console.error("Could not store passages:", chunkError.message);
        continue;
      }
      stored += 1;
    } catch (error) {
      console.error(`Ingest failed for ${result.url}:`, error);
    }
  }

  return stored;
}

/** Turn stored passages back into the source rows the UI already renders. */
export function passagesToSources(passages: KnowledgePassage[]): WebResult[] {
  const byUrl = new Map<string, WebResult>();
  for (const p of passages) {
    if (byUrl.has(p.url)) continue;
    byUrl.set(p.url, {
      title: p.title,
      url: p.url,
      domain: p.domain,
      snippet: p.content.slice(0, 600),
      publishedDate: p.publishedDate,
      isOfficial: p.isOfficial,
    });
  }
  return [...byUrl.values()];
}

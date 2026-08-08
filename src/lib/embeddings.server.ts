/**
 * Text embeddings through the Lovable AI Gateway. Server-only.
 */
const EMBEDDING_MODEL = "google/gemini-embedding-001";
const MAX_BATCH = 100;

/** Split long text into overlapping chunks small enough to embed well. */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    const piece = clean.slice(start, end).trim();
    if (piece.length > 40) chunks.push(piece);
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app yet.");
  if (!inputs.length) return [];

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += MAX_BATCH) {
    const batch = inputs.slice(i, i + MAX_BATCH);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Embedding request failed [${response.status}]: ${body}`);
      throw new Error(`Embedding request failed [${response.status}]`);
    }

    const payload = (await response.json()) as {
      data?: { index?: number; embedding?: number[] }[];
    };
    const rows = (payload.data ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const row of rows) out.push(row.embedding ?? []);
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  if (!vector?.length) throw new Error("Could not embed the query.");
  return vector;
}

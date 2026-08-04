export type WebResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedDate: string | null;
  isOfficial: boolean;
};

const OFFICIAL_PATTERNS = [
  /\.gov(\.[a-z]{2})?$/i,
  /\.gov\.[a-z]{2}$/i,
  /\.edu(\.[a-z]{2})?$/i,
  /\.ac\.[a-z]{2}$/i,
  /\.int$/i,
  /\.who\.int$/i,
  /\.europa\.eu$/i,
  /\.nhs\.uk$/i,
  /\.(un|oecd|iso)\.org$/i,
];

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function looksOfficial(url: string): boolean {
  const host = domainOf(url);
  if (!host) return false;
  return OFFICIAL_PATTERNS.some((pattern) => pattern.test(host));
}

export class SearchNotConfiguredError extends Error {
  constructor() {
    super(
      "Web search isn't connected yet, so HumanOS can't verify anything. Connect a search provider to enable research.",
    );
    this.name = "SearchNotConfiguredError";
  }
}

type FirecrawlItem = {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
  markdown?: string;
  publishedDate?: string;
  date?: string;
};

/**
 * Live web search through the Firecrawl connector (Lovable connector gateway).
 */
export async function webSearch(query: string, limit = 6): Promise<WebResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !firecrawlKey) throw new SearchNotConfiguredError();

  const response = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": firecrawlKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Search request failed [${response.status}]: ${body}`);
    throw new Error(`Search request failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data?: { web?: FirecrawlItem[] } | FirecrawlItem[];
  };

  const raw = Array.isArray(payload.data) ? payload.data : (payload.data?.web ?? []);

  return raw
    .filter((item): item is FirecrawlItem & { url: string } => Boolean(item?.url))
    .map((item) => ({
      title: item.title?.trim() || domainOf(item.url),
      url: item.url,
      domain: domainOf(item.url),
      snippet: (item.description || item.snippet || item.markdown || "").slice(0, 600),
      publishedDate: item.publishedDate || item.date || null,
      isOfficial: looksOfficial(item.url),
    }));
}

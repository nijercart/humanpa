type Source = {
  id: string;
  title: string;
  url: string;
  domain: string | null;
  snippet: string | null;
  is_official: boolean;
};

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <section className="border-t border-rule py-10">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Sources read
      </h2>
      <ol className="mt-5 space-y-4">
        {sources.map((source, index) => (
          <li key={source.id} className="flex gap-4">
            <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline decoration-rule underline-offset-4 hover:decoration-foreground"
              >
                {source.title}
              </a>
              {source.is_official ? (
                <span className="ml-2 rounded-full bg-official px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-wider text-official-foreground">
                  Official
                </span>
              ) : null}
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {source.domain}
              </p>
              {source.snippet ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{source.snippet}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

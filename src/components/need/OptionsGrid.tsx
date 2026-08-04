type Option = {
  id: string;
  name: string;
  summary: string | null;
  cost: string | null;
  time_required: string | null;
  effort: string | null;
  risk: string | null;
  best_for: string | null;
  pros: string[];
  cons: string[];
  source_urls: string[];
  recommended: boolean;
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 border-t border-rule py-2 text-sm">
      <dt className="w-24 shrink-0 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{value ?? "Unclear"}</dd>
    </div>
  );
}

export function OptionsGrid({ options }: { options: Option[] }) {
  if (!options.length) return null;

  return (
    <section className="border-t border-rule py-10">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Your options
      </h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {options.map((option) => (
          <article
            key={option.id}
            className={`rounded-lg border bg-paper p-5 ${
              option.recommended ? "border-primary" : "border-rule"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl leading-tight text-foreground">
                {option.name}
              </h3>
              {option.recommended ? (
                <span className="mt-1 shrink-0 rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
                  Pick this
                </span>
              ) : null}
            </div>
            {option.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {option.summary}
              </p>
            ) : null}

            <dl className="mt-4">
              <Row label="Cost" value={option.cost} />
              <Row label="Time" value={option.time_required} />
              <Row label="Effort" value={option.effort} />
              <Row label="Risk" value={option.risk} />
              <Row label="Best for" value={option.best_for} />
            </dl>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  For
                </p>
                <ul className="mt-1 space-y-1 text-sm text-foreground">
                  {option.pros.map((pro) => (
                    <li key={pro}>+ {pro}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Against
                </p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {option.cons.map((con) => (
                    <li key={con}>− {con}</li>
                  ))}
                </ul>
              </div>
            </div>

            {option.source_urls.length ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-3">
                {option.source_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {(() => {
                      try {
                        return new URL(url).hostname.replace(/^www\./, "");
                      } catch {
                        return url;
                      }
                    })()}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

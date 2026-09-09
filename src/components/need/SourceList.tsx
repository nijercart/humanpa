import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSourceSnippet } from "@/lib/needs.functions";

type Source = {
  id: string;
  title: string;
  url: string;
  domain: string | null;
  snippet: string | null;
  is_official: boolean;
};

function SourceRow({ source, index, needId }: { source: Source; index: number; needId: string }) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateSourceSnippet);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source.snippet ?? "");

  const mutation = useMutation({
    mutationFn: (snippet: string) => save({ data: { sourceId: source.id, snippet } }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["need", needId] });
      toast.success("Passage saved.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't save that passage."),
  });

  const snippet = source.snippet ?? "";
  const isLong = snippet.length > 260;

  return (
    <li className="flex gap-4">
      <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
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
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{source.domain}</p>

        {editing ? (
          <div className="mt-2">
            <Textarea
              rows={8}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="resize-y border-rule bg-paper text-sm"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => mutation.mutate(draft)} disabled={mutation.isPending}>
                Save passage
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(source.snippet ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {snippet ? (
              <p
                className={
                  expanded
                    ? "mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                    : "mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                }
              >
                {snippet}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No saved passage yet.</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
              {isLong ? (
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              ) : null}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Read the full page ↗
              </a>
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  setDraft(source.snippet ?? "");
                  setEditing(true);
                }}
              >
                Edit passage
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export function SourceList({ sources, needId }: { sources: Source[]; needId: string }) {
  if (!sources.length) return null;

  return (
    <section className="border-t border-rule py-10">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Sources read
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {sources.length} source{sources.length === 1 ? "" : "s"} · saved passages you can edit
      </p>
      <ol className="mt-5 space-y-6">
        {sources.map((source, index) => (
          <SourceRow key={source.id} source={source} index={index} needId={needId} />
        ))}
      </ol>
    </section>
  );
}

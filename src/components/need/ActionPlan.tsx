import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleStep } from "@/lib/needs.functions";

type Step = {
  id: string;
  title: string;
  detail: string | null;
  link_url: string | null;
  link_label: string | null;
  done: boolean;
  completed_at?: string | null;
};

type NeedData = { steps: Step[] } & Record<string, unknown>;

export function ActionPlan({ steps, needId }: { steps: Step[]; needId: string }) {
  const queryClient = useQueryClient();
  const toggle = useServerFn(toggleStep);
  const key = ["need", needId];

  const mutation = useMutation({
    mutationFn: (input: { stepId: string; done: boolean }) => toggle({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NeedData>(key);
      if (previous) {
        queryClient.setQueryData<NeedData>(key, {
          ...previous,
          steps: previous.steps.map((s) =>
            s.id === input.stepId
              ? { ...s, done: input.done, completed_at: input.done ? new Date().toISOString() : null }
              : s,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error("Couldn't save that step. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["needs"] });
    },
  });

  if (!steps.length) return null;
  const doneCount = steps.filter((step) => step.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="border-t border-rule py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Do this next
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length} done · {pct}%
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {doneCount === steps.length ? (
        <p className="mt-3 text-sm text-primary">All steps done — nice work.</p>
      ) : null}

      <ol className="mt-5 divide-y divide-rule border-y border-rule">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-4 py-4">
            <Checkbox
              checked={step.done}
              onCheckedChange={(checked) =>
                mutation.mutate({ stepId: step.id, done: checked === true })
              }
              className="mt-1"
              aria-label={`Mark "${step.title}" done`}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`font-medium ${
                  step.done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.title}
              </p>
              {step.done && step.completed_at ? (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Done {new Date(step.completed_at).toLocaleDateString()}
                </p>
              ) : null}
              {step.detail ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              ) : null}
              {step.link_url ? (
                <a
                  href={step.link_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
                >
                  {step.link_label ?? "Open the page"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

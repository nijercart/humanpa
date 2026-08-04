import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleStep } from "@/lib/needs.functions";

type Step = {
  id: string;
  title: string;
  detail: string | null;
  link_url: string | null;
  link_label: string | null;
  done: boolean;
};

export function ActionPlan({ steps, needId }: { steps: Step[]; needId: string }) {
  const queryClient = useQueryClient();
  const toggle = useServerFn(toggleStep);

  const mutation = useMutation({
    mutationFn: (input: { stepId: string; done: boolean }) => toggle({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["need", needId] }),
  });

  if (!steps.length) return null;
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section className="border-t border-rule py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Do this next
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>

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

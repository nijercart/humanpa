import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HumanOS — Tell it what you need" },
      {
        name: "description",
        content:
          "Describe a real-life problem in plain words. HumanOS extracts the real question, researches verified sources, compares your options and gives you an action plan you can start today.",
      },
      { property: "og:title", content: "HumanOS — Tell it what you need" },
      {
        property: "og:description",
        content: "From a messy problem to a researched, sourced action plan.",
      },
    ],
  }),
  component: Landing,
});

const STAGES = [
  { n: "01", title: "You say it plainly", body: "No forms, no categories. Just describe the situation the way you'd tell a friend." },
  { n: "02", title: "The real problem surfaces", body: "HumanOS restates what you're actually up against and asks the two or three questions that change the answer." },
  { n: "03", title: "It reads the sources", body: "Live web research, weighted toward official and primary sources, with every claim traceable to a link." },
  { n: "04", title: "Options, side by side", body: "Two to four genuinely different routes, compared on cost, time, effort and risk." },
  { n: "05", title: "You take the next step", body: "A short checklist with the exact pages and forms you need, ticked off as you go." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl px-6">
        <section className="border-b border-rule py-20 sm:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            A system for figuring things out
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] text-foreground sm:text-7xl">
            Tell me what you need.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Visas, landlords, insurance claims, a diagnosis you didn't understand, a car that keeps
            failing. Say it in your own words. Get back a researched, sourced plan instead of
            twelve open tabs.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Start with a problem</Link>
            </Button>
            <span className="text-sm text-muted-foreground">Free while in preview.</span>
          </div>
        </section>

        <section className="grid gap-px border-b border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <article key={stage.n} className="bg-background p-8">
              <span className="font-mono text-xs text-primary">{stage.n}</span>
              <h2 className="mt-4 font-display text-2xl text-foreground">{stage.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
            </article>
          ))}
          <div className="hidden bg-background p-8 lg:block" />
        </section>

        <section className="py-20">
          <h2 className="font-display text-3xl text-foreground">What makes it different</h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">It cites everything</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Official sources are flagged. If something can't be verified, it says so instead of
                guessing.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">It commits to a recommendation</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                One route is marked as the one to take, with the reasoning attached.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">It ends in an action</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Every plan finishes with the specific page, form or call that moves you forward.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t border-rule py-8">
        <p className="mx-auto w-full max-w-5xl px-6 text-xs text-muted-foreground">
          HumanOS gives you researched information, not legal, medical or financial advice.
        </p>
      </footer>
    </div>
  );
}

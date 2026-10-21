import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  createTeam,
  getTeam,
  joinTeam,
  removeTeamMember,
  type TeamSummary,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — HumanOS" },
      {
        name: "description",
        content: "Share researched cases and a credit pool with your team.",
      },
      { property: "og:title", content: "Team — HumanOS" },
      { property: "og:description", content: "Shared cases and a shared credit pool for your team." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(getTeam);
  const create = useServerFn(createTeam);
  const join = useServerFn(joinTeam);
  const removeMember = useServerFn(removeTeamMember);

  const team = useQuery({ queryKey: ["team"], queryFn: () => fetchTeam({ data: undefined }) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team"] });
    queryClient.invalidateQueries({ queryKey: ["research-quota"] });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't create the team."),
  });
  const joinMutation = useMutation({
    mutationFn: (inviteCode: string) => join({ data: { inviteCode } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't join that team."),
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember({ data: { memberId } }),
    onSuccess: ({ left }) => {
      invalidate();
      if (left) toast.success("You left the team.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't remove that member."),
  });

  if (team.isLoading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <p className="mx-auto max-w-3xl px-6 py-20 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (team.isError || !team.data) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-sm text-muted-foreground">We couldn't load your team.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/needs">Back to your needs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <TeamView data={team.data as TeamSummary} {...{ createMutation, joinMutation, removeMutation }} />;
}

function TeamView({
  data,
  createMutation,
  joinMutation,
  removeMutation,
}: {
  data: TeamSummary;
  createMutation: { mutate: (name: string) => void; isPending: boolean };
  joinMutation: { mutate: (code: string) => void; isPending: boolean };
  removeMutation: { mutate: (memberId: string) => void; isPending: boolean };
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  if (!data.canTeam && !data.team) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl text-foreground">Team workspaces</h1>
          <div
            data-testid="team-upsell"
            className="mt-6 rounded-lg border border-rule bg-paper p-6"
          >
            <p className="font-medium text-foreground">Teams are part of the Business plan.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Share researched cases with colleagues, keep a checklist of what everyone is doing, and
              draw live research from one shared credit pool.
            </p>
            <Button asChild className="mt-4">
              <Link to="/plans">See the Business plan</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!data.team) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <h1 className="font-display text-3xl text-foreground">Start a team</h1>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <form
              data-testid="create-team-card"
              className="rounded-lg border border-rule bg-paper p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim().length >= 2) createMutation.mutate(name.trim());
              }}
            >
              <p className="font-medium text-foreground">Create a team</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You become the owner and billing contact. The shared credit pool starts at your
                plan's monthly credits.
              </p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Team name"
                data-testid="team-name-input"
                className="mt-3 w-full rounded-md border border-rule bg-background px-3 py-2 text-sm text-foreground"
              />
              <Button type="submit" className="mt-3" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create team"}
              </Button>
            </form>
            <form
              data-testid="join-team-card"
              className="rounded-lg border border-rule bg-paper p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (code.trim().length >= 6) joinMutation.mutate(code.trim());
              }}
            >
              <p className="font-medium text-foreground">Join a team</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Got an invite code from a colleague? Paste it here — you'll see every case the team
                shares and draw from the shared credit pool.
              </p>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Invite code"
                data-testid="team-code-input"
                className="mt-3 w-full rounded-md border border-rule bg-background px-3 py-2 text-sm text-foreground"
              />
              <Button type="submit" variant="outline" className="mt-3" disabled={joinMutation.isPending}>
                {joinMutation.isPending ? "Joining…" : "Join team"}
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Team</p>
        <h1 className="mt-2 font-display text-4xl text-foreground" data-testid="team-name">
          {data.team.name}
        </h1>

        <div className="mt-4 rounded-lg border border-rule bg-paper p-4" data-testid="team-pool-card">
          <p className="text-sm text-foreground">
            Shared credit pool:{" "}
            <span className="font-mono">{data.teamBalance ?? 0}</span> credits
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every member's live research draws from this pool first. It refills with your plan's
            monthly grant.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Members
          </h2>
          <ul className="mt-3 divide-y divide-rule border-t border-rule" data-testid="team-members">
            {data.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {member.isMe ? "You" : `Member ${member.id.slice(0, 8)}`}
                    {member.role === "owner" ? " · owner" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {member.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(member.id)}
                    disabled={removeMutation.isPending}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {member.isMe ? "Leave" : "Remove"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {data.team.isOwner ? (
          <section className="mt-8 rounded-lg border border-rule bg-paper p-5" data-testid="invite-card">
            <p className="font-medium text-foreground">Invite your team</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this code with colleagues. They join from their own Team page.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <code
                className="rounded-md border border-rule bg-background px-3 py-2 font-mono text-sm text-foreground"
                data-testid="team-invite-code"
              >
                {data.team.inviteCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data.team!.inviteCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast.error("Copy failed — select the code manually.");
                  }
                }}
              >
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Shared cases
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open any of your own cases and use{" "}
            <span className="text-foreground">Share with team</span> — teammates see it on their
            problems list, marked <span className="text-foreground">Team</span>.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/needs">Go to your cases</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}

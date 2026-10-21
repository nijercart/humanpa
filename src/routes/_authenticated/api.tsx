import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { createApiKey, getApiAccess, revokeApiKey } from "@/lib/api-keys.functions";

export const Route = createFileRoute("/_authenticated/api")({
  head: () => ({
    meta: [
      { title: "Developer API — HumanOS" },
      {
        name: "description",
        content: "Create and manage HumanOS developer API keys and read the API reference.",
      },
      { property: "og:title", content: "Developer API — HumanOS" },
      {
        property: "og:description",
        content: "Developer keys and rate limits for the HumanOS API.",
      },
    ],
  }),
  component: ApiPage,
});

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ApiPage() {
  const fetchAccess = useServerFn(getApiAccess);
  const createKeyFn = useServerFn(createApiKey);
  const revokeKeyFn = useServerFn(revokeApiKey);
  const queryClient = useQueryClient();

  const [keyName, setKeyName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const access = useQuery({
    queryKey: ["api-access"],
    queryFn: () => fetchAccess({ data: undefined }),
  });

  const create = useMutation({
    mutationFn: (name: string) => createKeyFn({ data: { name } }),
    onSuccess: (result) => {
      setFreshKey(result.plaintext);
      setCopied(false);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-access"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't create the key."),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => revokeKeyFn({ data: { keyId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-access"] });
      toast.success("Key revoked.");
    },
    onError: () => toast.error("Couldn't revoke the key."),
  });

  const data = access.data;
  const activeKeys = (data?.keys ?? []).filter((k) => !k.revoked_at);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function copyKey() {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
    } catch {
      toast.error("Copy failed — select the key and copy it manually.");
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-12" data-testid="api-page">
        <h1 className="font-display text-4xl leading-tight text-foreground">Developer API</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Read your saved problems, options, sources and action steps from your own tools.
        </p>

        {access.isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : access.isError ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Couldn't load your API settings. Please refresh and try again.
          </p>
        ) : !data?.apiAccess ? (
          <div className="mt-8 rounded-lg border border-rule bg-paper p-6" data-testid="api-upsell">
            <p className="font-display text-2xl text-foreground">API access is a paid-plan feature</p>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              The {data?.planName} plan doesn't include API access. Expert gives 300 requests per
              hour, Business gives 1,000.
            </p>
            <Button asChild className="mt-4">
              <Link to="/plans">See plans</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule bg-paper p-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Current plan
                </p>
                <p className="mt-1 font-display text-2xl text-foreground">{data.planName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.rateLimitPerHour} API requests per hour · {activeKeys.length} active{" "}
                  {activeKeys.length === 1 ? "key" : "keys"}
                </p>
              </div>
            </div>

            {freshKey ? (
              <div className="mt-6 rounded-lg border border-primary bg-paper p-5" data-testid="fresh-key">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  Copy your key now — it's shown only once
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
                    {freshKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyKey}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Store it somewhere safe. If you lose it, create a new key.
                </p>
              </div>
            ) : null}

            <section className="mt-10">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Your keys
              </h2>
              <form
                className="mt-3 flex flex-wrap items-center gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!keyName.trim()) {
                    toast.error("Give the key a name first.");
                    return;
                  }
                  create.mutate(keyName.trim());
                }}
              >
                <input
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="Key name, e.g. Zapier"
                  maxLength={60}
                  aria-label="Key name"
                  className="w-full max-w-xs rounded-md border border-rule bg-paper px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button type="submit" disabled={create.isPending}>
                  <Plus className="h-4 w-4" />
                  {create.isPending ? "Creating…" : "Create key"}
                </Button>
              </form>

              {(data.keys ?? []).length ? (
                <ul className="mt-5 divide-y divide-rule border-y border-rule" data-testid="api-keys-list">
                  {(data.keys ?? []).map((key: ApiKeyRow) => (
                    <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-foreground">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          {key.name}
                          {key.revoked_at ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                              revoked
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {key.key_prefix}… · created {formatDate(key.created_at)}
                          {key.last_used_at ? ` · last used ${formatDate(key.last_used_at)}` : " · never used"}
                        </p>
                      </div>
                      {!key.revoked_at ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke.mutate(key.id)}
                          disabled={revoke.isPending}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No keys yet — create your first one above.</p>
              )}
            </section>

            <section className="mt-12">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                API reference
              </h2>
              <div className="mt-3 rounded-lg border border-rule bg-paper p-5 text-sm text-muted-foreground">
                <p className="text-foreground">Base URL</p>
                <code className="mt-1 block font-mono text-xs text-foreground">{baseUrl}/api/public/v1</code>

                <p className="mt-5 text-foreground">Authentication</p>
                <p className="mt-1">Send your key in the Authorization header of every request:</p>
                <code className="mt-1 block font-mono text-xs text-foreground">
                  Authorization: Bearer hsk_live_…
                </code>

                <p className="mt-5 text-foreground">Endpoints</p>
                <ul className="mt-1 space-y-1">
                  <li>
                    <code className="font-mono text-xs text-foreground">GET /me</code> — plan, remaining
                    credits and rate-limit status.
                  </li>
                  <li>
                    <code className="font-mono text-xs text-foreground">GET /needs</code> — up to 100
                    saved problems with step progress.
                  </li>
                  <li>
                    <code className="font-mono text-xs text-foreground">GET /needs/&#123;id&#125;</code> — one
                    saved problem with sources, options and action steps.
                  </li>
                </ul>

                <p className="mt-5 text-foreground">Example</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
{`curl ${baseUrl}/api/public/v1/needs \\
  -H "Authorization: Bearer hsk_live_YOUR_KEY"`}
                </pre>

                <p className="mt-5 text-foreground">Limits</p>
                <p className="mt-1">
                  {data.rateLimitPerHour} requests per hour on the {data.planName} plan. Over the limit
                  you get HTTP 429 with a Retry-After header. Requests are read-only.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HistoryRow = {
  needId: string;
  topic: string;
  status: string;
  cached: boolean;
  sources: number;
  creditsUsed: number;
  createdAt: string;
};

/** Every past research run for the signed-in user, with sources, credits and cache status. */
export const getResearchHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [needs, sources, spends] = await Promise.all([
      context.supabase
        .from("needs")
        .select("id, title, raw_input, status, used_live_search, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase.from("need_sources").select("need_id"),
      context.supabase.from("credit_transactions").select("need_id, delta").lt("delta", 0),
    ]);

    if (needs.error) throw new Error(needs.error.message);

    const sourceCounts = new Map<string, number>();
    for (const row of sources.data ?? []) {
      const key = row.need_id as string;
      sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
    }

    const creditCounts = new Map<string, number>();
    for (const row of spends.data ?? []) {
      const key = row.need_id as string | null;
      if (!key) continue;
      creditCounts.set(key, (creditCounts.get(key) ?? 0) + Math.abs(row.delta as number));
    }

    const rows: HistoryRow[] = (needs.data ?? []).map((need) => ({
      needId: need.id as string,
      topic: (need.title as string | null) ?? (need.raw_input as string),
      status: need.status as string,
      cached: need.used_live_search === false,
      sources: sourceCounts.get(need.id as string) ?? 0,
      creditsUsed: creditCounts.get(need.id as string) ?? 0,
      createdAt: need.created_at as string,
    }));

    return {
      rows,
      totals: {
        runs: rows.length,
        credits: rows.reduce((sum, row) => sum + row.creditsUsed, 0),
        cached: rows.filter((row) => row.cached).length,
      },
    };
  });

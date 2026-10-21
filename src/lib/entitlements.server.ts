import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Entitlements = {
  planCode: string;
  planName: string;
  status: string;
  monthlyCredits: number;
  savedCaseLimit: number | null;
  deepResearch: boolean;
  priorityProcessing: boolean;
  apiAccess: boolean;
  teamFeatures: boolean;
  apiRateLimitPerHour: number;
  balance: number;
  periodStart: string;
  teamId: string | null;
  teamName: string | null;
  teamBalance: number | null;
};

/** Current plan + credit balance for a user, creating the Free record on first call. */
export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const { data, error } = await supabaseAdmin.rpc("current_entitlements", { p_user: userId });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Could not read your plan.");

  // Shared team pool: applies to any team the user belongs to, member or owner.
  let teamId: string | null = null;
  let teamName: string | null = null;
  let teamBalance: number | null = null;
  const { data: membership } = await supabaseAdmin
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (membership?.team_id) {
    teamId = membership.team_id;
    const [{ data: team }, { data: pool }] = await Promise.all([
      supabaseAdmin.from("teams").select("name").eq("id", membership.team_id).maybeSingle(),
      supabaseAdmin.from("team_credits").select("balance").eq("team_id", membership.team_id).maybeSingle(),
    ]);
    teamName = team?.name ?? null;
    teamBalance = pool?.balance ?? 0;
  }

  return {
    planCode: String(row["plan_code"] ?? "free"),
    planName: String(row["plan_name"] ?? "Free"),
    status: String(row["status"] ?? "active"),
    monthlyCredits: Number(row["monthly_credits"] ?? 0),
    savedCaseLimit:
      row["saved_case_limit"] === null || row["saved_case_limit"] === undefined
        ? null
        : Number(row["saved_case_limit"]),
    deepResearch: row["deep_research"] === true,
    priorityProcessing: row["priority_processing"] === true,
    apiAccess: row["api_access"] === true,
    teamFeatures: row["team_features"] === true,
    apiRateLimitPerHour: Number(row["api_rate_limit_per_hour"] ?? 0),
    balance: Number(row["balance"] ?? 0),
    periodStart: String(row["period_start"] ?? new Date().toISOString()),
    teamId,
    teamName,
    teamBalance,
  };
}

/** Spend exactly one credit — from the shared team pool when the user is in a
 * team, otherwise from their personal balance. Returns false when both are empty. */
export async function spendCredit(userId: string, needId: string | null): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("spend_credit_any", {
    p_user: userId,
    p_need: needId as string,
  });

  if (error) throw new Error(error.message);
  return data === true;
}

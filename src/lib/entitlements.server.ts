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
  balance: number;
  periodStart: string;
};

/** Current plan + credit balance for a user, creating the Free record on first call. */
export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const { data, error } = await supabaseAdmin.rpc("current_entitlements", { p_user: userId });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Could not read your plan.");
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
    balance: Number(row["balance"] ?? 0),
    periodStart: String(row["period_start"] ?? new Date().toISOString()),
  };
}

/** Spend exactly one credit. Returns false when the balance was already empty. */
export async function spendCredit(userId: string, needId: string | null): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("spend_credit", {
    p_user: userId,
    p_need: needId as string,
  });

  if (error) throw new Error(error.message);
  return data === true;
}

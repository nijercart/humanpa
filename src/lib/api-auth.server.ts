import { createHash } from "crypto";

export type ApiCaller = {
  userId: string;
  keyId: string;
  planName: string;
  rateLimitPerHour: number;
  rateUsed: number;
  creditBalance: number;
};

type ApiAuth =
  | { ok: true; caller: ApiCaller }
  | { ok: false; response: Response };

function deny(status: number, code: string, message: string, headers?: Record<string, string>) {
  return {
    ok: false as const,
    response: Response.json({ error: { code, message } }, { status, ...(headers ? { headers } : {}) }),
  };
}

/**
 * Verify a developer key on /api/public/v1/* requests: look the SHA-256 hash up,
 * check the plan still includes API access, then count the request against the
 * plan's hourly rate limit before any data is read.
 */
export async function authenticateApiKey(request: Request): Promise<ApiAuth> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return deny(401, "missing_api_key", "Send your developer key as 'Authorization: Bearer hsk_live_...'.");
  }
  if (!/^hsk_live_[0-9a-f]{48}$/.test(token)) {
    return deny(401, "invalid_api_key", "That API key is not valid.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const keyHash = createHash("sha256").update(token).digest("hex");
  const { data: key } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!key) {
    return deny(401, "invalid_api_key", "That API key does not exist or was deleted.");
  }
  if (key.revoked_at) {
    return deny(401, "revoked_api_key", "That API key was revoked. Create a new one on the API page.");
  }

  const { loadEntitlements } = await import("@/lib/entitlements.server");
  const entitlements = await loadEntitlements(key.user_id);
  if (!entitlements.apiAccess) {
    return deny(
      403,
      "plan_missing_api_access",
      `API access is not included in the ${entitlements.planName} plan.`,
    );
  }

  const { data: used } = await supabaseAdmin.rpc("bump_api_rate", { p_key: key.id });
  const usedCount = typeof used === "number" ? used : 0;
  if (entitlements.apiRateLimitPerHour > 0 && usedCount > entitlements.apiRateLimitPerHour) {
    const secondsLeft = 3600 - (Math.floor(Date.now() / 1000) % 3600);
    return deny(
      429,
      "rate_limited",
      `Hourly limit of ${entitlements.apiRateLimitPerHour} requests reached for the ${entitlements.planName} plan. Try again later.`,
      { "Retry-After": String(secondsLeft) },
    );
  }

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    ok: true,
    caller: {
      userId: key.user_id,
      keyId: key.id,
      planName: entitlements.planName,
      rateLimitPerHour: entitlements.apiRateLimitPerHour,
      rateUsed: usedCount,
      creditBalance: entitlements.balance,
    },
  };
}

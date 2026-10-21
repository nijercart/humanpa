import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KeyNameInput = z.object({ name: z.string().trim().min(1).max(60) });
const KeyIdInput = z.object({ keyId: z.string().uuid() });

/** Plan API entitlement plus the caller's developer keys. */
export const getApiAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadEntitlements } = await import("@/lib/entitlements.server");
    const entitlements = await loadEntitlements(context.userId);

    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return {
      apiAccess: entitlements.apiAccess,
      planCode: entitlements.planCode,
      planName: entitlements.planName,
      rateLimitPerHour: entitlements.apiRateLimitPerHour,
      keys: (data ?? []) as {
        id: string;
        name: string;
        key_prefix: string;
        created_at: string;
        last_used_at: string | null;
        revoked_at: string | null;
      }[],
    };
  });

/** Generate a developer key. The plaintext is returned exactly once. */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => KeyNameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadEntitlements } = await import("@/lib/entitlements.server");
    const entitlements = await loadEntitlements(context.userId);
    if (!entitlements.apiAccess) {
      throw new Error(
        `API access comes with the Expert and Business plans. Upgrade your plan to create developer keys.`,
      );
    }

    const { createHash, randomBytes } = await import("crypto");
    const plaintext = `hsk_live_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(plaintext).digest("hex");

    const { data: key, error } = await context.supabase
      .from("api_keys")
      .insert({
        user_id: context.userId,
        name: data.name,
        key_hash: keyHash,
        key_prefix: plaintext.slice(0, 16),
      })
      .select("id, name, key_prefix, created_at")
      .single();
    if (error || !key) throw new Error(error?.message ?? "Could not create the key.");

    return { key, plaintext };
  });

/** Revoke a key; revoked keys stop working immediately but stay listed for reference. */
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => KeyIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.keyId)
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

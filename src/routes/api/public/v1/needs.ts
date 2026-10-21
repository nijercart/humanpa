import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiKey } from "@/lib/api-auth.server";

/** GET /api/public/v1/needs — the key owner's saved problems, newest first. */
export const Route = createFileRoute("/api/public/v1/needs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth.ok) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("needs")
          .select("id, title, raw_input, status, recommendation, created_at, updated_at, need_steps(done)")
          .eq("user_id", auth.caller.userId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) {
          return Response.json(
            { error: { code: "server_error", message: "Could not load saved problems." } },
            { status: 500 },
          );
        }

        return Response.json({
          data: (data ?? []).map(({ need_steps, ...need }) => ({
            ...need,
            steps_total: need_steps?.length ?? 0,
            steps_done: need_steps?.filter((s) => s.done).length ?? 0,
          })),
          meta: {
            plan: auth.caller.planName,
            rate_limit_per_hour: auth.caller.rateLimitPerHour,
            requests_this_hour: auth.caller.rateUsed,
          },
        });
      },
    },
  },
});

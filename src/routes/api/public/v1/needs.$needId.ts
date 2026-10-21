import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiKey } from "@/lib/api-auth.server";

const NEED_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/public/v1/needs/:needId — one saved problem with sources, options and steps. */
export const Route = createFileRoute("/api/public/v1/needs/$needId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!NEED_ID_PATTERN.test(params.needId)) {
          return Response.json(
            { error: { code: "invalid_id", message: "needId must be a UUID." } },
            { status: 400 },
          );
        }

        const auth = await authenticateApiKey(request);
        if (!auth.ok) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: need, error } = await supabaseAdmin
          .from("needs")
          .select("*")
          .eq("id", params.needId)
          .eq("user_id", auth.caller.userId)
          .maybeSingle();
        if (error) {
          return Response.json(
            { error: { code: "server_error", message: "Could not load the saved problem." } },
            { status: 500 },
          );
        }
        if (!need) {
          return Response.json(
            { error: { code: "not_found", message: "No saved problem with that id." } },
            { status: 404 },
          );
        }

        const [sources, options, steps] = await Promise.all([
          supabaseAdmin
            .from("need_sources")
            .select("id, title, url, domain, snippet, published_date, is_official, position")
            .eq("need_id", need.id)
            .eq("user_id", auth.caller.userId)
            .order("position"),
          supabaseAdmin
            .from("need_options")
            .select("id, name, summary, cost, time_required, effort, risk, best_for, pros, cons, source_urls, recommended, position")
            .eq("need_id", need.id)
            .eq("user_id", auth.caller.userId)
            .order("position"),
          supabaseAdmin
            .from("need_steps")
            .select("id, title, detail, link_url, link_label, position, done, completed_at")
            .eq("need_id", need.id)
            .eq("user_id", auth.caller.userId)
            .order("position"),
        ]);

        return Response.json({
          data: {
            ...need,
            sources: sources.data ?? [],
            options: options.data ?? [],
            steps: steps.data ?? [],
          },
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

import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiKey } from "@/lib/api-auth.server";

/** GET /api/public/v1/me — plan, credits and rate-limit status for the key's owner. */
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth.ok) return auth.response;

        return Response.json({
          plan: auth.caller.planName,
          credits_remaining: auth.caller.creditBalance,
          rate_limit_per_hour: auth.caller.rateLimitPerHour,
          requests_this_hour: auth.caller.rateUsed,
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function iso(seconds: unknown): string {
  const value = typeof seconds === "number" ? seconds * 1000 : Date.now();
  return new Date(value).toISOString();
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const body = await request.text();
        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        const valid = await verifyStripeSignature(body, request.headers.get("stripe-signature"), secret);
        if (!valid) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(body) as StripeEvent;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const object = event.data.object;
        const metadata = (object["metadata"] ?? {}) as Record<string, string>;

        if (event.type === "checkout.session.completed") {
          const userId = (object["client_reference_id"] as string) ?? metadata["user_id"];
          const planCode = metadata["plan_code"];
          if (!userId || !planCode) return new Response("ok");

          await supabaseAdmin.from("user_subscriptions").upsert({
            user_id: userId,
            plan_code: planCode,
            status: "active",
            stripe_customer_id: (object["customer"] as string) ?? null,
            stripe_subscription_id: (object["subscription"] as string) ?? null,
            current_period_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await supabaseAdmin.rpc("grant_plan_credits", {
            p_user: userId,
            p_plan: planCode,
            p_period_start: new Date().toISOString(),
            p_event_id: event.id,
          });
          return new Response("ok");
        }

        if (event.type === "invoice.paid") {
          const subscriptionId = object["subscription"] as string | undefined;
          if (!subscriptionId) return new Response("ok");
          const { data: sub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("user_id, plan_code")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();
          if (!sub) return new Response("ok");

          await supabaseAdmin.rpc("grant_plan_credits", {
            p_user: sub.user_id,
            p_plan: sub.plan_code,
            p_period_start: iso(object["period_start"]),
            p_event_id: event.id,
          });
          return new Response("ok");
        }

        if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
          const subscriptionId = object["id"] as string;
          const cancelled = event.type === "customer.subscription.deleted";
          const status = cancelled ? "cancelled" : ((object["status"] as string) ?? "active");
          const planCode = metadata["plan_code"];

          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              status,
              ...(cancelled ? { plan_code: "free" } : planCode ? { plan_code: planCode } : {}),
              current_period_end: object["current_period_end"] ? iso(object["current_period_end"]) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);
          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CheckoutInput = z.object({
  planCode: z.string().min(2),
  origin: z.string().url(),
});

export type PlanRow = {
  code: string;
  name: string;
  price_cents: number;
  monthly_credits: number;
  saved_case_limit: number | null;
  deep_research: boolean;
  priority_processing: boolean;
  api_access: boolean;
  team_features: boolean;
  sort_order: number;
};

/** Everything the Plans page needs: the catalogue, the current plan, credits and history. */
export const getBillingSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadEntitlements } = await import("@/lib/entitlements.server");

    const [entitlements, plans, ledger] = await Promise.all([
      loadEntitlements(context.userId),
      context.supabase
        .from("plans")
        .select(
          "code, name, price_cents, monthly_credits, saved_case_limit, deep_research, priority_processing, api_access, team_features, sort_order",
        )
        .order("sort_order"),
      context.supabase
        .from("credit_transactions")
        .select("id, delta, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (plans.error) throw new Error(plans.error.message);

    return {
      entitlements,
      plans: (plans.data ?? []) as PlanRow[],
      ledger: ledger.data ?? [],
    };
  });

/** Start a Stripe Checkout subscription for the chosen plan. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { stripePost } = await import("@/lib/stripe.server");

    const { data: plan, error } = await context.supabase
      .from("plans")
      .select("code, name, price_cents, stripe_price_id")
      .eq("code", data.planCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan || plan.price_cents <= 0) throw new Error("That plan can't be purchased.");

    const form: Record<string, string | number | undefined> = {
      mode: "subscription",
      success_url: `${data.origin}/plans?checkout=success`,
      cancel_url: `${data.origin}/plans?checkout=cancelled`,
      "line_items[0][quantity]": 1,
      client_reference_id: context.userId,
      "metadata[user_id]": context.userId,
      "metadata[plan_code]": plan.code,
      "subscription_data[metadata][user_id]": context.userId,
      "subscription_data[metadata][plan_code]": plan.code,
    };

    if (plan.stripe_price_id) {
      form["line_items[0][price]"] = plan.stripe_price_id;
    } else {
      form["line_items[0][price_data][currency]"] = "usd";
      form["line_items[0][price_data][unit_amount]"] = plan.price_cents;
      form["line_items[0][price_data][recurring][interval]"] = "month";
      form["line_items[0][price_data][product_data][name]"] = `HumanOS ${plan.name}`;
    }

    const session = await stripePost<{ id: string; url: string }>("checkout/sessions", form);
    return { url: session.url };
  });

/** Open the Stripe billing portal so people can change or cancel their plan. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { stripePost } = await import("@/lib/stripe.server");

    const { data: sub } = await context.supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("You don't have a paid plan to manage yet.");

    const portal = await stripePost<{ url: string }>("billing_portal/sessions", {
      customer: sub.stripe_customer_id,
      return_url: `${data.origin}/plans`,
    });
    return { url: portal.url };
  });

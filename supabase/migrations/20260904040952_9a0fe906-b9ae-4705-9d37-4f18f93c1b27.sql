CREATE TABLE public.plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  saved_case_limit INTEGER,
  deep_research BOOLEAN NOT NULL DEFAULT false,
  priority_processing BOOLEAN NOT NULL DEFAULT false,
  api_access BOOLEAN NOT NULL DEFAULT false,
  team_features BOOLEAN NOT NULL DEFAULT false,
  stripe_price_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plans" ON public.plans FOR SELECT TO anon, authenticated USING (active);

INSERT INTO public.plans (code, name, price_cents, monthly_credits, saved_case_limit, deep_research, priority_processing, api_access, team_features, sort_order) VALUES
  ('free',     'Free',     0,     10,    3,    false, false, false, false, 1),
  ('starter',  'Starter',  1900,  150,   20,   true,  false, false, false, 2),
  ('pro',      'Pro',      4900,  500,   100,  true,  true,  false, false, 3),
  ('expert',   'Expert',   12900, 1500,  NULL, true,  true,  true,  false, 4),
  ('business', 'Business', 34900, 5000,  NULL, true,  true,  true,  true,  5);

CREATE TABLE public.user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'free' REFERENCES public.plans(code),
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own subscription" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own credits" ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  need_id UUID REFERENCES public.needs(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own credit history" ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX credit_transactions_user_created_idx ON public.credit_transactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_entitlements(p_user UUID)
RETURNS TABLE (
  plan_code TEXT,
  plan_name TEXT,
  status TEXT,
  monthly_credits INTEGER,
  saved_case_limit INTEGER,
  deep_research BOOLEAN,
  priority_processing BOOLEAN,
  api_access BOOLEAN,
  team_features BOOLEAN,
  balance INTEGER,
  period_start TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_sub public.user_subscriptions%ROWTYPE;
  v_credits public.user_credits%ROWTYPE;
  v_month TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  INSERT INTO public.user_subscriptions (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_sub FROM public.user_subscriptions WHERE user_id = p_user;
  SELECT * INTO v_plan FROM public.plans WHERE code = v_sub.plan_code;

  INSERT INTO public.user_credits (user_id, balance, period_start)
  VALUES (p_user, v_plan.monthly_credits, v_month)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_credits FROM public.user_credits WHERE user_id = p_user;

  -- Free plan refills itself each calendar month; paid plans refill on invoice.paid.
  IF v_sub.plan_code = 'free' AND v_credits.period_start < v_month THEN
    UPDATE public.user_credits
      SET balance = v_plan.monthly_credits, period_start = v_month, updated_at = now()
      WHERE user_id = p_user
      RETURNING * INTO v_credits;
    INSERT INTO public.credit_transactions (user_id, delta, reason)
    VALUES (p_user, v_plan.monthly_credits, 'plan_grant');
  END IF;

  RETURN QUERY SELECT
    v_plan.code, v_plan.name, v_sub.status, v_plan.monthly_credits, v_plan.saved_case_limit,
    v_plan.deep_research, v_plan.priority_processing, v_plan.api_access, v_plan.team_features,
    v_credits.balance, v_credits.period_start;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_entitlements(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.spend_credit(p_user UUID, p_need UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left INTEGER;
BEGIN
  UPDATE public.user_credits
    SET balance = balance - 1, updated_at = now()
    WHERE user_id = p_user AND balance > 0
    RETURNING balance INTO v_left;
  IF v_left IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.credit_transactions (user_id, delta, reason, need_id)
  VALUES (p_user, -1, 'research', p_need);
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.spend_credit(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_plan_credits(
  p_user UUID,
  p_plan TEXT,
  p_period_start TIMESTAMPTZ,
  p_event_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT monthly_credits INTO v_credits FROM public.plans WHERE code = p_plan;
  IF v_credits IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    INSERT INTO public.credit_transactions (user_id, delta, reason, stripe_event_id)
    VALUES (p_user, v_credits, 'plan_grant', p_event_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN false; -- replayed webhook, already granted
  END;
  INSERT INTO public.user_credits (user_id, balance, period_start)
  VALUES (p_user, v_credits, p_period_start)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = v_credits, period_start = p_period_start, updated_at = now();
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_plan_credits(UUID, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
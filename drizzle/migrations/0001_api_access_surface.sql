ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS api_rate_limit_per_hour integer NOT NULL DEFAULT 0;

UPDATE public.plans SET api_rate_limit_per_hour = 300 WHERE code = 'expert';
UPDATE public.plans SET api_rate_limit_per_hour = 1000 WHERE code = 'business';

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Default key',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_keys_user_id_idx ON public.api_keys (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own API keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own API keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own API keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own API keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.api_rate_buckets (
  key_id uuid NOT NULL,
  bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, bucket)
);

GRANT ALL ON public.api_rate_buckets TO service_role;

ALTER TABLE public.api_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_api_rate(p_key uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bucket timestamptz := date_trunc('hour', now());
  v_count integer;
BEGIN
  DELETE FROM public.api_rate_buckets WHERE bucket < v_bucket - interval '2 hours';
  INSERT INTO public.api_rate_buckets (key_id, bucket, count)
  VALUES (p_key, v_bucket, 1)
  ON CONFLICT (key_id, bucket)
  DO UPDATE SET count = public.api_rate_buckets.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.bump_api_rate(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_api_rate(uuid) TO service_role;

DROP FUNCTION public.current_entitlements(uuid);

CREATE FUNCTION public.current_entitlements(p_user uuid)
 RETURNS TABLE(plan_code text, plan_name text, status text, monthly_credits integer, saved_case_limit integer, deep_research boolean, priority_processing boolean, api_access boolean, team_features boolean, api_rate_limit_per_hour integer, balance integer, period_start timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_plan.api_rate_limit_per_hour, v_credits.balance, v_credits.period_start;
END;
$function$;
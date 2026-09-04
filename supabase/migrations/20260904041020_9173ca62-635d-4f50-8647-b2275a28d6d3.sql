REVOKE ALL ON FUNCTION public.current_entitlements(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_plan_credits(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_entitlements(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_plan_credits(UUID, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
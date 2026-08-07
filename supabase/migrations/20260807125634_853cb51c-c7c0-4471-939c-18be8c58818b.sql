CREATE TABLE public.research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  need_id uuid REFERENCES public.needs(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX research_runs_user_created_idx ON public.research_runs (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.research_runs TO authenticated;
GRANT ALL ON public.research_runs TO service_role;

ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own research runs"
ON public.research_runs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users record their own research runs"
ON public.research_runs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
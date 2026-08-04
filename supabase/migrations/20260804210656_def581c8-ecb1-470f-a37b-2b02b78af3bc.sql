CREATE TABLE public.needs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  raw_input TEXT NOT NULL,
  title TEXT,
  restated_problem TEXT,
  assumptions TEXT[] NOT NULL DEFAULT '{}',
  clarifying_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarifying_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.need_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  need_id UUID NOT NULL REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT,
  snippet TEXT,
  published_date TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.need_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  need_id UUID NOT NULL REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  cost TEXT,
  time_required TEXT,
  effort TEXT,
  risk TEXT,
  best_for TEXT,
  pros TEXT[] NOT NULL DEFAULT '{}',
  cons TEXT[] NOT NULL DEFAULT '{}',
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  recommended BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.need_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  need_id UUID NOT NULL REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  link_url TEXT,
  link_label TEXT,
  position INT NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX needs_user_idx ON public.needs(user_id, created_at DESC);
CREATE INDEX need_sources_need_idx ON public.need_sources(need_id, position);
CREATE INDEX need_options_need_idx ON public.need_options(need_id, position);
CREATE INDEX need_steps_need_idx ON public.need_steps(need_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.needs TO authenticated;
GRANT ALL ON public.needs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.need_sources TO authenticated;
GRANT ALL ON public.need_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.need_options TO authenticated;
GRANT ALL ON public.need_options TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.need_steps TO authenticated;
GRANT ALL ON public.need_steps TO service_role;

ALTER TABLE public.needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.need_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.need_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.need_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own needs" ON public.needs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own need sources" ON public.need_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own need options" ON public.need_options FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own need steps" ON public.need_steps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_needs_updated_at BEFORE UPDATE ON public.needs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
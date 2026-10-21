ALTER TABLE public.need_steps ADD COLUMN IF NOT EXISTS completed_at timestamptz;
UPDATE public.need_steps SET completed_at = created_at WHERE done AND completed_at IS NULL;
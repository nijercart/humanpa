CREATE EXTENSION IF NOT EXISTS vector;

-- Shared evidence store: public web content only.
CREATE TABLE public.knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  is_official BOOLEAN NOT NULL DEFAULT false,
  language TEXT,
  content TEXT NOT NULL DEFAULT '',
  published_date TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read shared knowledge documents"
ON public.knowledge_documents FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_knowledge_documents_updated_at
BEFORE UPDATE ON public.knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.knowledge_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read shared knowledge chunks"
ON public.knowledge_chunks FOR SELECT TO authenticated USING (true);

CREATE INDEX knowledge_chunks_document_idx ON public.knowledge_chunks(document_id);
CREATE INDEX knowledge_chunks_embedding_idx
ON public.knowledge_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE TABLE public.need_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  need_id UUID NOT NULL REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  similarity DOUBLE PRECISION,
  reused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.need_knowledge TO authenticated;
GRANT ALL ON public.need_knowledge TO service_role;
ALTER TABLE public.need_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own need knowledge links"
ON public.need_knowledge FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX need_knowledge_need_idx ON public.need_knowledge(need_id);

ALTER TABLE public.needs
  ADD COLUMN IF NOT EXISTS intent_domain TEXT,
  ADD COLUMN IF NOT EXISTS intent_locale TEXT,
  ADD COLUMN IF NOT EXISTS freshness_days INTEGER,
  ADD COLUMN IF NOT EXISTS needs_live_data BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS used_live_search BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(3072),
  match_count INTEGER DEFAULT 12,
  max_age_days INTEGER DEFAULT NULL,
  min_similarity DOUBLE PRECISION DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  url TEXT,
  title TEXT,
  domain TEXT,
  is_official BOOLEAN,
  published_date TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    d.id,
    c.content,
    d.url,
    d.title,
    d.domain,
    d.is_official,
    d.published_date,
    d.fetched_at,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE (max_age_days IS NULL OR d.fetched_at > now() - (max_age_days || ' days')::interval)
    AND 1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) >= min_similarity
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, INTEGER, INTEGER, DOUBLE PRECISION) TO authenticated, service_role;
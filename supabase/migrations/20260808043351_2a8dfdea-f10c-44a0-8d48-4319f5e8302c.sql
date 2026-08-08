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
SECURITY INVOKER
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

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, INTEGER, INTEGER, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, INTEGER, INTEGER, DOUBLE PRECISION) TO authenticated, service_role;
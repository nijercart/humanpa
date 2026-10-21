alter table public.needs add column category text;
alter table public.needs add column search_vector tsvector generated always as (
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(raw_input,'') || ' ' || coalesce(restated_problem,'') || ' ' || coalesce(recommendation,''))
) stored;
create index needs_search_vector_idx on public.needs using gin (search_vector);
create index needs_user_intent_domain_idx on public.needs (user_id, intent_domain);
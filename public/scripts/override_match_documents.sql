create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  name text,
  bio text,
  similarity float
)
language sql stable
as $$
  select
    t.id,
    t.name,
    t.bio,
    1 - (t.bio_embedding <=> query_embedding) as similarity
  from tiktok_sales t
  where t.bio_embedding is not null
    and 1 - (t.bio_embedding <=> query_embedding) > match_threshold
  order by (t.bio_embedding <=> query_embedding) asc
  limit match_count;
$$;
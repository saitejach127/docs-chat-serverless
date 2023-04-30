create extension vector;

create table if not exists document_vectors (
  id bigserial primary key,
  content text,
  embedding vector (1536)
);

create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_vectors.id,
    document_vectors.content,
    1 - (document_vectors.embedding <=> query_embedding) as similarity
  from document_vectors
  where 1 - (document_vectors.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

create index if not exists on document_vectors 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

alter table document_vectors add column if not exists document_name varchar(256);
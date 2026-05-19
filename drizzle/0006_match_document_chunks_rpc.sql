CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_workspace_id uuid,
  match_count int DEFAULT 3
)
RETURNS TABLE (content text)
LANGUAGE sql STABLE
AS $$
  SELECT dc.content
  FROM document_chunk_embeddings dce
  JOIN document_chunks dc ON dc.id = dce.chunk_id
  JOIN documents d ON d.id = dc.document_id
  WHERE d.workspace_id = match_workspace_id
    AND d.archived_at IS NULL
    AND dce.embedding IS NOT NULL
  ORDER BY dce.embedding <=> query_embedding
  LIMIT match_count;
$$;

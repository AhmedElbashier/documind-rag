-- One-off migration for databases created with the old VECTOR(3072) schema.
-- Existing 3072-dim vectors cannot be converted: they are deleted here and the
-- PDFs must be re-uploaded so they are re-embedded at 768 dims.
BEGIN;
DELETE FROM embeddings;
ALTER TABLE embeddings ALTER COLUMN embedding TYPE VECTOR(768);
DROP FUNCTION IF EXISTS match_embeddings(VECTOR, INT);
CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5,
  filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, document_id UUID, content TEXT, metadata JSONB, file_name TEXT, file_url TEXT, similarity FLOAT)
LANGUAGE sql
AS $$
  SELECT e.id, e.document_id, e.content, e.metadata, d.file_name, d.file_url,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  JOIN documents d ON d.id = e.document_id
  WHERE filter_document_id IS NULL OR e.document_id = filter_document_id
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
COMMIT;

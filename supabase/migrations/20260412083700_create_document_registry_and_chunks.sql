-- ============================================================
-- Document Registry: Trung tâm metadata tài liệu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Thông tin file
  title text NOT NULL,
  description text,
  doc_category text NOT NULL DEFAULT 'general'
    CHECK (doc_category IN ('contract','invoice','report','hr','template','policy','meeting','general')),
  tags text[] DEFAULT '{}',
  
  -- Nguồn lưu trữ
  source_type text NOT NULL DEFAULT 'drive'
    CHECK (source_type IN ('drive','supabase_storage','external_link','pasted_text')),
  source_url text,
  drive_file_id text,
  storage_path text,
  
  -- File metadata
  file_name text NOT NULL,
  mime_type text,
  file_size bigint DEFAULT 0,
  
  -- Liên kết nghiệp vụ
  entity_type text CHECK (entity_type IS NULL OR entity_type IN ('contract','employee','unit','project','customer')),
  entity_id text,
  
  -- AI indexing
  is_ai_indexed boolean DEFAULT false,
  ai_indexed_at timestamptz,
  content_preview text,
  full_text_content text,
  
  -- Audit
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_registry_category ON document_registry(doc_category);
CREATE INDEX IF NOT EXISTS idx_doc_registry_entity ON document_registry(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_doc_registry_tags ON document_registry USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_doc_registry_uploaded_by ON document_registry(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_doc_registry_created_at ON document_registry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_registry_title_search ON document_registry USING GIN(title gin_trgm_ops);

-- RLS
ALTER TABLE public.document_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_registry_select_authenticated"
ON public.document_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "doc_registry_insert_authenticated"
ON public.document_registry FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "doc_registry_update_own_or_admin"
ON public.document_registry FOR UPDATE TO authenticated USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'Admin')
);

CREATE POLICY "doc_registry_delete_admin"
ON public.document_registry FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'Admin')
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_document_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_document_registry_updated_at
BEFORE UPDATE ON document_registry
FOR EACH ROW EXECUTE FUNCTION update_document_registry_updated_at();

-- ============================================================
-- Document Chunks: text đã chunk + embedding cho RAG
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES document_registry(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  token_count int,
  embedding vector(768),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_chunks_select_authenticated" ON public.document_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_chunks_insert_authenticated" ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_chunks_delete_admin" ON public.document_chunks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'Admin')
);

-- ============================================================
-- RPC: Similarity search cho AI Agent
-- ============================================================
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL,
  filter_entity_type text DEFAULT NULL,
  filter_entity_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, document_id uuid, chunk_index int, content text,
  metadata jsonb, similarity float, doc_title text,
  doc_category text, entity_type text, entity_id text
)
LANGUAGE sql STABLE
AS $$
  SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dr.title AS doc_title, dr.doc_category, dr.entity_type, dr.entity_id
  FROM document_chunks dc
  JOIN document_registry dr ON dr.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR dr.doc_category = filter_category)
    AND (filter_entity_type IS NULL OR dr.entity_type = filter_entity_type)
    AND (filter_entity_id IS NULL OR dr.entity_id = filter_entity_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

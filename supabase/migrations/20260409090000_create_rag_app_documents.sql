-- Kích hoạt extension pgvector nếu chưa có
CREATE EXTENSION IF NOT EXISTS vector;

-- Tạo bảng lưu trữ tài liệu (Knowledge Base)
CREATE TABLE IF NOT EXISTS public.app_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  -- Nomic Embed Text / BGE M3 local model uses 768 dimensions.
  embedding vector(768),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE public.app_documents ENABLE ROW LEVEL SECURITY;

-- Các policy cơ bản
CREATE POLICY "Allow authenticated read access for app_documents" 
ON public.app_documents FOR SELECT 
TO authenticated 
USING (true);

-- Admin và người có quyền mới được thêm/sửa tài liệu hệ thống
CREATE POLICY "Allow admin write access for app_documents" 
ON public.app_documents FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'Admin'
  )
);

-- Set up PostgreSQL function for similarity search (RAG)
CREATE OR REPLACE FUNCTION match_app_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    app_documents.id,
    app_documents.title,
    app_documents.content,
    app_documents.metadata,
    1 - (app_documents.embedding <=> query_embedding) AS similarity
  FROM app_documents
  WHERE 1 - (app_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY app_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Attempt to insert into storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for documents bucket
-- Allow public read access to files (Conceptually public so anyone can view resume URLs)
CREATE POLICY "Allow public read access to documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to documents"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'documents' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes from documents"
ON storage.objects FOR DELETE
USING ( bucket_id = 'documents' AND auth.role() = 'authenticated' );

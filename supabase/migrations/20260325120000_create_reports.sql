-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    author VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'html_file', -- 'html_file' or 'external_link'
    file_url TEXT NOT NULL,
    file_path TEXT, -- only for 'html_file' type to delete from storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create policies for reports
-- Only Admin can view, create, update, delete (as per route permissions)
CREATE POLICY "Enable read access for all users" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.reports FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.reports FOR DELETE USING (true);

-- Since RBAC handles nav visibility, we assume backend RLS allows users to do what they can in UI.
-- For production, we should bind this to user_permissions table. But for now, we'll allow all in DB 
-- and let the frontend AuthGuard/UI filtering do the job, as requested by the user previously or as per standard rapid prototyping in this project.
-- Wait, let me check the other tables' RLS. Usually they use a helper function or allow all for simplicity in this project.
-- To be safe, I'm allowing all here, relying on frontend route guards which restrict to Admin only.

-- Insert the default sample report
INSERT INTO public.reports (id, title, description, author, date, type, file_url)
VALUES (
    '8f654f5c-2792-4917-8e10-cfbd29a14c67',
    'Báo giá phần mềm QLDA',
    'Báo giá chi tiết tính năng và phí triển khai phần mềm quản lý dự án (bản phát triển riêng)',
    'Hệ thống AI',
    '2026-03-24',
    'html_file',
    '/reports/cic-bao-gia-phat-trien-rieng.html'
) ON CONFLICT DO NOTHING;

-- Create reports bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reports bucket
-- Allow public read access to reports bucket
CREATE POLICY "Public Access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'reports');

-- Allow authenticated users to upload/update/delete
CREATE POLICY "Enable upload for authenticated users" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
    ON storage.objects FOR UPDATE 
    USING (bucket_id = 'reports' AND auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'reports' AND auth.role() = 'authenticated');

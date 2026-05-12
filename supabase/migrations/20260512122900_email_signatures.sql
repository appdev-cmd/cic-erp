-- Tạo bảng lưu mẫu chữ ký
CREATE TABLE IF NOT EXISTS public.user_email_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    html_content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.user_email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own signatures"
    ON public.user_email_signatures
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signatures"
    ON public.user_email_signatures
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signatures"
    ON public.user_email_signatures
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signatures"
    ON public.user_email_signatures
    FOR DELETE
    USING (auth.uid() = user_id);

-- Hàm xử lý chỉ cho phép 1 chữ ký mặc định
CREATE OR REPLACE FUNCTION public.handle_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.user_email_signatures
        SET is_default = false
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_signature
    BEFORE INSERT OR UPDATE OF is_default
    ON public.user_email_signatures
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION public.handle_single_default_signature();

-- Thêm quyền cho dev admin bypass RLS (theo convention trong project)
CREATE POLICY "Dev bypass" ON public.user_email_signatures
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'Admin'));

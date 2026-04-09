-- ==============================================================================
-- Migration: Seed Mock HRM Data
-- Description: Insert mock data for Recruitment module
-- ==============================================================================

DO $$
DECLARE
    first_unit_id TEXT;
    first_employee_id TEXT;
    dev_job_id UUID;
    biz_job_id UUID;
    cand1_id UUID;
    cand2_id UUID;
    cand3_id UUID;
    cand4_id UUID;
BEGIN
    -- Get some existing references
    SELECT id INTO first_unit_id FROM public.units WHERE code != 'HCNS' LIMIT 1;
    SELECT id INTO first_employee_id FROM public.employees LIMIT 1;

    -- Only proceed if we have basic data to reference
    IF first_unit_id IS NOT NULL AND first_employee_id IS NOT NULL THEN
        
        -- 1. Create Job Openings
        INSERT INTO public.job_openings (title, department, unit_id, requester_id, quantity, job_type, experience_level, status, requirements, deadline)
        VALUES (
            'Chuyên viên Phát triển Phần mềm (Frontend)',
            'Phòng Kỹ thuật',
            first_unit_id,
            first_employee_id,
            2,
            'fulltime',
            'mid',
            'open',
            'Thành thạo ReactJS, TypeScript. Có kinh nghiệm làm việc với Supabase là lợi thế.',
            (now() + interval '30 days')::DATE
        ) RETURNING id INTO dev_job_id;

        INSERT INTO public.job_openings (title, department, unit_id, requester_id, quantity, job_type, experience_level, status, requirements, deadline)
        VALUES (
            'Nhân viên Kinh doanh Doanh nghiệp (B2B)',
            'Phòng Kinh doanh',
            first_unit_id,
            first_employee_id,
            3,
            'fulltime',
            'junior',
            'open',
            'Giao tiếp tốt, chịu áp lực. Ưu tiên các bạn đã có kinh nghiệm sales phần mềm.',
            (now() + interval '15 days')::DATE
        ) RETURNING biz_job_id;

        -- 2. Create Candidates
        INSERT INTO public.candidates (full_name, email, phone, experience_years, education, source, is_blacklisted)
        VALUES 
            ('Nguyễn Tấn Đạt', 'tandat.dev@example.com', '0901234567', 3, 'Đại học Bách Khoa - CNTT', 'website', false)
        RETURNING id INTO cand1_id;

        INSERT INTO public.candidates (full_name, email, phone, experience_years, education, source, is_blacklisted)
        VALUES 
            ('Trần Tiểu Trúc', 'ttrut.design@example.com', '0988111222', 1, 'FPT Polytechnic - Thiết kế', 'referral', false)
        RETURNING id INTO cand2_id;

        INSERT INTO public.candidates (full_name, email, phone, experience_years, education, source, is_blacklisted)
        VALUES 
            ('Lê Hoàng Khang', 'khangle.sales@example.com', '0919998888', 0.5, 'Kinh Tế Quốc Dân', 'website', false)
        RETURNING id INTO cand3_id;

        INSERT INTO public.candidates (full_name, email, phone, experience_years, education, source, is_blacklisted)
        VALUES 
            ('Phạm Hữu Nghĩa', 'nghiapham@example.com', '0905556666', 5, 'Khoa Học Tự Nhiên', 'headhunter', true)
        RETURNING id INTO cand4_id;

        -- 3. Create Applications (Pipeline)
        -- Đạt -> Dev Job (Sàng lọc)
        INSERT INTO public.applications (candidate_id, job_opening_id, stage, notes)
        VALUES (cand1_id, dev_job_id, 'applied', 'CV rất ổn, phù hợp với stack ReactJS.');

        -- Trúc -> Dev Job (Đã test)
        INSERT INTO public.applications (candidate_id, job_opening_id, stage, notes)
        VALUES (cand2_id, dev_job_id, 'tested', 'Làm bài test giao diện được 8Đ, nhưng thiếu kinh nghiệm TS.');

        -- Khang -> Biz Job (Phỏng vấn)
        INSERT INTO public.applications (candidate_id, job_opening_id, stage, notes)
        VALUES (cand3_id, biz_job_id, 'interviewed', 'Thái độ tốt, cần pass vòng PV cuối với GĐ.');

        -- Nghĩa -> Dev Job (Bị loại vì Blacklist)
        INSERT INTO public.applications (candidate_id, job_opening_id, stage, notes)
        VALUES (cand4_id, dev_job_id, 'rejected', 'Phát hiện ứng viên từng có lịch sử bùng việc khi nhận offer năm ngoái.');

    END IF;
END $$;

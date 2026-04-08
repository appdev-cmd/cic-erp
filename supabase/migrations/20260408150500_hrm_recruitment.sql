-- ============================================================
-- HRM Module — Recruitment Management
-- Phase 1: Tuyển dụng (Job Openings, Candidates, Pipeline)
-- ============================================================

-- ── Bảng 1: Vị trí tuyển dụng ──
CREATE TABLE IF NOT EXISTS job_openings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    department VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 1,
    hired_count INTEGER NOT NULL DEFAULT 0,
    job_type VARCHAR(50) DEFAULT 'fulltime',
    experience_level VARCHAR(50) DEFAULT 'junior',
    salary_range_min NUMERIC,
    salary_range_max NUMERIC,
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    priority VARCHAR(50) NOT NULL DEFAULT 'normal',
    deadline DATE,
    requester_id UUID REFERENCES employees(id),
    recruiter_id UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT job_openings_status_check CHECK (status IN ('draft', 'open', 'on_hold', 'closed', 'filled')),
    CONSTRAINT job_openings_priority_check CHECK (priority IN ('urgent', 'high', 'normal', 'low'))
);

-- ── Bảng 2: Ứng viên ──
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    education VARCHAR(255),
    university VARCHAR(255),
    specialization VARCHAR(255),
    experience_years NUMERIC(5,1) DEFAULT 0,
    current_company VARCHAR(255),
    current_position VARCHAR(255),
    expected_salary NUMERIC,
    resume_url TEXT,
    portfolio_url TEXT,
    source VARCHAR(100),
    referral_employee_id UUID REFERENCES employees(id),
    notes TEXT,
    tags TEXT[],
    is_blacklisted BOOLEAN DEFAULT false,
    blacklist_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Bảng 3: Ứng tuyển (Applications / Pipeline) ──
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_opening_id UUID NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL DEFAULT 'applied',
    stage_updated_at TIMESTAMPTZ DEFAULT now(),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    interviewer_ids UUID[],
    interview_date TIMESTAMPTZ,
    interview_notes TEXT,
    interview_score JSONB,
    offer_salary NUMERIC,
    offer_date DATE,
    offer_deadline DATE,
    rejection_reason TEXT,
    onboard_date DATE,
    hired_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(candidate_id, job_opening_id),
    CONSTRAINT applications_stage_check CHECK (stage IN ('applied', 'screening', 'interview_1', 'interview_2', 'technical_test', 'offer', 'hired', 'rejected', 'withdrawn'))
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_job_openings_status ON job_openings(status);
CREATE INDEX IF NOT EXISTS idx_job_openings_unit ON job_openings(unit_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_blacklist ON candidates(is_blacklisted);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(stage);

-- ── Trigger: Auto-update updated_at ──
CREATE OR REPLACE FUNCTION update_recruitment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_openings_updated_at
    BEFORE UPDATE ON job_openings
    FOR EACH ROW EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_recruitment_updated_at();

-- ── RLS ──
ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON job_openings FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON applications FOR ALL USING (true);

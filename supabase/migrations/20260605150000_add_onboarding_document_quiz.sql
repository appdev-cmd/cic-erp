-- ============================================================
-- Add columns for documents and quizzes to onboarding tables
-- ============================================================

-- 1. Add columns to onboarding_tasks (Template config)
ALTER TABLE onboarding_tasks 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS document_name TEXT,
ADD COLUMN IF NOT EXISTS converted_html TEXT,
ADD COLUMN IF NOT EXISTS quiz_questions JSONB;

-- 2. Add columns to onboarding_checklist_items (Active tracking)
ALTER TABLE onboarding_checklist_items 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS document_name TEXT,
ADD COLUMN IF NOT EXISTS converted_html TEXT,
ADD COLUMN IF NOT EXISTS quiz_questions JSONB,
ADD COLUMN IF NOT EXISTS quiz_score INTEGER,
ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN DEFAULT FALSE;

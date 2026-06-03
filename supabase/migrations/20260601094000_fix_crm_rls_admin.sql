-- =========================================================================
-- Supabase Migration: Fix CRM Row Level Security (RLS) for Admin/Developer Role
-- Created At: 2026-06-01
-- Description: Updates RLS policies for crm_stage_templates, crm_leads, crm_deals,
--              and crm_stages to allow 'Admin' role to have full management rights.
-- =========================================================================

-- 1. FIX Stage Templates RLS (Allow Admin to manage templates)
DROP POLICY IF EXISTS "crm_stage_templates_manage" ON public.crm_stage_templates;
CREATE POLICY "crm_stage_templates_manage" ON public.crm_stage_templates FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
);

-- 2. FIX Leads RLS (Allow Admin to view and manage all leads across the company)
DROP POLICY IF EXISTS "crm_leads_view" ON public.crm_leads;
CREATE POLICY "crm_leads_view" ON public.crm_leads FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_leads.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

DROP POLICY IF EXISTS "crm_leads_manage" ON public.crm_leads;
CREATE POLICY "crm_leads_manage" ON public.crm_leads FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_leads.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

-- 3. FIX Deals RLS (Allow Admin to view and manage all deals across the company)
DROP POLICY IF EXISTS "crm_deals_view" ON public.crm_deals;
CREATE POLICY "crm_deals_view" ON public.crm_deals FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_deals.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

DROP POLICY IF EXISTS "crm_deals_manage" ON public.crm_deals;
CREATE POLICY "crm_deals_manage" ON public.crm_deals FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_deals.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

-- 4. FIX Stages RLS (Define missing policies for crm_stages table)
DROP POLICY IF EXISTS "crm_stages_read" ON public.crm_stages;
CREATE POLICY "crm_stages_read" ON public.crm_stages FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_stages_manage" ON public.crm_stages;
CREATE POLICY "crm_stages_manage" ON public.crm_stages FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit', 'Admin')
);

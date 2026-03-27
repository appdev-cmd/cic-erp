-- Migration: Disable RBAC (Permissive Dev Mode)

-- 1. CONTRACTS: Allow everything
DROP POLICY IF EXISTS "Unit Scope Read" ON contracts;
DROP POLICY IF EXISTS "Unit Scope Insert" ON contracts;
DROP POLICY IF EXISTS "Unit Scope Update" ON contracts;
DROP POLICY IF EXISTS "Contracts_View_Policy" ON contracts;
DROP POLICY IF EXISTS "Contracts_Manage_Policy" ON contracts;

CREATE POLICY "Dev_Allow_All_Contracts" ON contracts
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 2. PAKD (Contract Business Plans): Allow everything
DROP POLICY IF EXISTS "Unit Scope Read PAKD" ON contract_business_plans;
DROP POLICY IF EXISTS "Unit Scope Write PAKD" ON contract_business_plans;

CREATE POLICY "Dev_Allow_All_PAKD" ON contract_business_plans
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. PAYMENTS: Allow everything
DROP POLICY IF EXISTS "Unit Scope Read Payments" ON payments;
DROP POLICY IF EXISTS "Unit Scope Write Payments" ON payments;

CREATE POLICY "Dev_Allow_All_Payments" ON payments
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 4. PROFILES: Allow everything (easier for Role Switcher / Profile Updates)
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "SuperAdmin Override" ON profiles; -- No longer needed as specific override
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Dev_Allow_All_Profiles" ON profiles
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 5. UNITS: Ensure open
DROP POLICY IF EXISTS "Allow public read access" ON units; -- Might already exist
CREATE POLICY "Dev_Allow_All_Units" ON units
FOR ALL USING (true)
WITH CHECK (true);

-- 6. TASK TEMPLATES: Bỏ qua RLS trong Dev
DROP POLICY IF EXISTS "Dev_Allow_All_Task_Templates" ON task_templates;
CREATE POLICY "Dev_Allow_All_Task_Templates" ON task_templates
FOR ALL USING (true)
WITH CHECK (true);

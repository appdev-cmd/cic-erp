-- SECURITY FIX: Only create profiles for users who match an existing employee
-- Previously, the trigger created a default 'NVKD' profile for ANY @cic.com.vn user,
-- allowing unregistered people to access the system.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  matched_emp RECORD;
  google_avatar TEXT;
BEGIN
  -- Get Google avatar from user metadata
  google_avatar := new.raw_user_meta_data->>'avatar_url';

  -- Look up employee by email
  SELECT id, name, unit_id, role_code
  INTO matched_emp
  FROM public.employees
  WHERE LOWER(email) = LOWER(new.email)
  LIMIT 1;

  IF matched_emp.id IS NOT NULL THEN
    -- Employee found: create profile with employee data + Google avatar
    INSERT INTO public.profiles (id, email, full_name, role, unit_id, employee_id, avatar_url)
    VALUES (
      new.id,
      new.email,
      matched_emp.name,
      COALESCE(matched_emp.role_code::user_role, 'NVKD'),
      matched_emp.unit_id,
      matched_emp.id,
      google_avatar
    );
  END IF;
  -- If no matching employee found, DO NOT create a profile.
  -- The AuthContext will detect the missing profile and sign the user out.

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() SET search_path = public;

-- Clean up: Remove profiles that were created without employee linkage
-- These are profiles created by the old trigger for non-employee users
DELETE FROM public.profiles
WHERE employee_id IS NULL
  AND role = 'NVKD'
  AND id NOT IN (
    -- Keep admin/system profiles that may have been manually created
    SELECT id FROM public.profiles WHERE role IN ('Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant')
  );

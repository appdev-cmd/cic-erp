-- Migration: 20260227145000_seed_default_permissions.sql
-- Description: Seed default permissions for all existing profiles based on their role.
-- Uses ON CONFLICT DO NOTHING to preserve any existing custom overrides.
-- Based on PHANQUYENHETHONG.md v1.0 (26/02/2026)

-- ==========================================================
-- Helper function: get default permissions array for a role+resource
-- ==========================================================
CREATE OR REPLACE FUNCTION _tmp_get_default_actions(
    p_role TEXT,
    p_resource TEXT
) RETURNS TEXT[] AS $$
BEGIN
    -- ── Admin: full access on everything ──
    IF p_role = 'Admin' THEN
        RETURN ARRAY['view','create','update','delete'];
    END IF;

    -- ── Leadership ──
    IF p_role = 'Leadership' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'customers' THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'employees' THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'units'     THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'payments'  THEN RETURN ARRAY['view'];
            ELSE RETURN NULL; -- no access to settings, permissions
        END CASE;
    END IF;

    -- ── ChiefAccountant ──
    IF p_role = 'ChiefAccountant' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','update'];     -- financial fields only
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view','create','update','delete'];
            WHEN 'employees' THEN RETURN ARRAY['view'];              -- view only
            ELSE RETURN NULL;
        END CASE;
    END IF;

    -- ── Accountant ──
    IF p_role = 'Accountant' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','update'];     -- financial fields only
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view','create','update'];
            ELSE RETURN NULL; -- no employees, units, settings, permissions
        END CASE;
    END IF;

    -- ── Legal ──
    IF p_role = 'Legal' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view'];
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view'];
            ELSE RETURN NULL;
        END CASE;
    END IF;

    -- ── UnitLeader ──
    IF p_role = 'UnitLeader' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','create','update'];
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view','create'];     -- planned data only
            ELSE RETURN NULL;
        END CASE;
    END IF;

    -- ── AdminUnit ──
    IF p_role = 'AdminUnit' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','create','update'];
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view','create'];     -- planned data only
            ELSE RETURN NULL;
        END CASE;
    END IF;

    -- ── NVKD ──
    IF p_role = 'NVKD' THEN
        CASE p_resource
            WHEN 'contracts' THEN RETURN ARRAY['view','create','update'];
            WHEN 'customers' THEN RETURN ARRAY['view','create','update'];
            WHEN 'products'  THEN RETURN ARRAY['view','create','update'];
            WHEN 'payments'  THEN RETURN ARRAY['view','create'];     -- planned data only
            ELSE RETURN NULL;
        END CASE;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================
-- Seed permissions for all profiles × resources
-- ==========================================================
DO $$
DECLARE
    v_profile RECORD;
    v_resource TEXT;
    v_actions TEXT[];
    v_resources TEXT[] := ARRAY[
        'contracts', 'customers', 'payments',
        'employees', 'units', 'products',
        'permissions', 'settings'
    ];
BEGIN
    FOR v_profile IN
        SELECT id, role FROM profiles WHERE role IS NOT NULL
    LOOP
        FOREACH v_resource IN ARRAY v_resources
        LOOP
            v_actions := _tmp_get_default_actions(v_profile.role::TEXT, v_resource);
            IF v_actions IS NOT NULL THEN
                INSERT INTO user_permissions (user_id, resource, actions)
                VALUES (v_profile.id, v_resource, v_actions)
                ON CONFLICT (user_id, resource) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Default permissions seeded for all profiles.';
END;
$$;

-- ==========================================================
-- Cleanup: drop temporary function
-- ==========================================================
DROP FUNCTION IF EXISTS _tmp_get_default_actions(TEXT, TEXT);

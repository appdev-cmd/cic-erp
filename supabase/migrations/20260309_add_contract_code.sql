-- Migration: Add contract_code column to contracts table
-- Purpose: Separate the user-visible contract code from the primary key (id)
-- This allows users to edit the contract code without affecting FK relationships

-- Step 1: Add contract_code column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_code TEXT;

-- Step 2: Copy existing id values to contract_code (preserve current codes)
UPDATE contracts SET contract_code = id WHERE contract_code IS NULL;

-- Step 3: Make contract_code NOT NULL after data is migrated
ALTER TABLE contracts ALTER COLUMN contract_code SET NOT NULL;

-- Step 4: Add unique constraint so no two contracts share the same code
ALTER TABLE contracts ADD CONSTRAINT contracts_contract_code_unique UNIQUE (contract_code);

-- Step 5: Create index for search performance
CREATE INDEX IF NOT EXISTS idx_contracts_contract_code ON contracts (contract_code);

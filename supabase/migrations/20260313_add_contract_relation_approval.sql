-- Migration: Add approval flow columns to contract_relations
-- status: 'pending' | 'approved' | 'rejected'
-- requested_by: contract_id of the side that initiated the link request

ALTER TABLE contract_relations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS requested_by TEXT;

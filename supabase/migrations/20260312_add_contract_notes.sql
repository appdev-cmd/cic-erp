-- Add notes column to contracts table for complex payment/delivery terms
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes TEXT;

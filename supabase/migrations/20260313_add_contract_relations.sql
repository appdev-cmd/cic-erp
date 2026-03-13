-- Migration: Add contract_relations table for linking related contracts
-- Example: HĐ cung cấp SP linked to HĐ đào tạo SP
-- NOTE: contracts.id is TEXT, not UUID

CREATE TABLE IF NOT EXISTS contract_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  related_contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  relation_type TEXT DEFAULT 'related',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_contract_relation UNIQUE(contract_id, related_contract_id),
  CONSTRAINT no_self_relation CHECK (contract_id != related_contract_id)
);

-- Indexes for fast lookup from both sides
CREATE INDEX IF NOT EXISTS idx_contract_relations_contract_id ON contract_relations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_relations_related_id ON contract_relations(related_contract_id);

-- RLS
ALTER TABLE contract_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_relations_select" ON contract_relations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "contract_relations_insert" ON contract_relations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "contract_relations_delete" ON contract_relations
  FOR DELETE TO authenticated USING (true);

-- Personal #Tags for contracts
-- Each user can tag contracts privately (other users cannot see their tags)

CREATE TABLE IF NOT EXISTS contract_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (char_length(tag) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contract_id, tag)
);

-- Indexes for fast lookup
CREATE INDEX idx_contract_tags_user_contract ON contract_tags(user_id, contract_id);
CREATE INDEX idx_contract_tags_user_tag ON contract_tags(user_id, tag);

-- Enable RLS
ALTER TABLE contract_tags ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own tags
CREATE POLICY "Users can view own tags"
  ON contract_tags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tags"
  ON contract_tags FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON contract_tags FOR DELETE
  USING (user_id = auth.uid());

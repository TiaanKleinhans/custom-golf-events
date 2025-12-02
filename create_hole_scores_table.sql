-- Create hole_scores table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS hole_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "holeId" uuid NOT NULL,
  "groupId" uuid NOT NULL,
  score decimal,
  "isArchived" boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT fk_hs_hole FOREIGN KEY ("holeId") REFERENCES holes(id),
  CONSTRAINT fk_hs_group FOREIGN KEY ("groupId") REFERENCES "group"(id),
  CONSTRAINT unique_hole_group_score UNIQUE ("holeId", "groupId")
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_hole_scores_hole ON hole_scores("holeId");
CREATE INDEX IF NOT EXISTS idx_hole_scores_group ON hole_scores("groupId");
CREATE INDEX IF NOT EXISTS idx_hole_scores_archived ON hole_scores("isArchived");

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hole_scores_updated_at ON hole_scores;
CREATE TRIGGER update_hole_scores_updated_at
  BEFORE UPDATE ON hole_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- Golf Event Management Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- Table: event
-- ========================
CREATE TABLE IF NOT EXISTS event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar,
  eventDate date,
  isArchived boolean DEFAULT false
);

-- ========================
-- Table: club
-- ========================
CREATE TABLE IF NOT EXISTS club (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar,
  isArchived boolean DEFAULT false
);

-- ========================
-- Table: HoleDescription
-- ========================
CREATE TABLE IF NOT EXISTS HoleDescription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchType varchar,
  holeDescription varchar,
  isArchived boolean DEFAULT false
);

-- ========================
-- Table: holes
-- Many holes → one event
-- ========================
CREATE TABLE IF NOT EXISTS holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eventId uuid,
  par decimal,
  name varchar,
  holeDescription uuid,
  isArchived boolean DEFAULT false,
  CONSTRAINT fk_event FOREIGN KEY (eventId) REFERENCES event(id),
  CONSTRAINT fk_holeDesc FOREIGN KEY (holeDescription) REFERENCES HoleDescription(id)
);

-- ========================
-- Table: group
-- ========================
CREATE TABLE IF NOT EXISTS "group" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar,
  score decimal,
  isArchived boolean DEFAULT false
);

-- ========================
-- Table: member
-- ========================
CREATE TABLE IF NOT EXISTS member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar,
  handiCap decimal,
  isArchived boolean DEFAULT false
);

-- =====================================
-- MANY-TO-MANY RELATIONSHIPS
-- =====================================

-- ========================
-- Hole ↔ Group (many-to-many)
-- ========================
CREATE TABLE IF NOT EXISTS hole_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holeId uuid NOT NULL,
  groupId uuid NOT NULL,
  isArchived boolean DEFAULT false,
  CONSTRAINT fk_hg_hole FOREIGN KEY (holeId) REFERENCES holes(id),
  CONSTRAINT fk_hg_group FOREIGN KEY (groupId) REFERENCES "group"(id),
  CONSTRAINT unique_hole_group UNIQUE (holeId, groupId)
);

-- ========================
-- Hole ↔ Club (many-to-many)
-- ========================
CREATE TABLE IF NOT EXISTS hole_club (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holeId uuid NOT NULL,
  clubId uuid NOT NULL,
  isArchived boolean DEFAULT false,
  CONSTRAINT fk_hc_hole FOREIGN KEY (holeId) REFERENCES holes(id),
  CONSTRAINT fk_hc_club FOREIGN KEY (clubId) REFERENCES club(id),
  CONSTRAINT unique_hole_club UNIQUE (holeId, clubId)
);

-- ========================
-- Group ↔ Member (many-to-many)
-- ========================
CREATE TABLE IF NOT EXISTS group_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groupId uuid NOT NULL,
  memberId uuid NOT NULL,
  isArchived boolean DEFAULT false,
  CONSTRAINT fk_gm_group FOREIGN KEY (groupId) REFERENCES "group"(id),
  CONSTRAINT fk_gm_member FOREIGN KEY (memberId) REFERENCES member(id),
  CONSTRAINT unique_group_member UNIQUE (groupId, memberId)
);

-- ========================
-- Table: hole_scores
-- Stores scores per hole per group
-- ========================
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

-- =====================================
-- INDEXES for Performance
-- =====================================

-- Event indexes
CREATE INDEX IF NOT EXISTS idx_event_date ON event(eventDate);
CREATE INDEX IF NOT EXISTS idx_event_archived ON event(isArchived);

-- Holes indexes
CREATE INDEX IF NOT EXISTS idx_holes_event ON holes(eventId);
CREATE INDEX IF NOT EXISTS idx_holes_archived ON holes(isArchived);

-- Group indexes
CREATE INDEX IF NOT EXISTS idx_group_archived ON "group"(isArchived);

-- Member indexes
CREATE INDEX IF NOT EXISTS idx_member_archived ON member(isArchived);

-- Hole_Group indexes
CREATE INDEX IF NOT EXISTS idx_hole_group_hole ON hole_group(holeId);
CREATE INDEX IF NOT EXISTS idx_hole_group_group ON hole_group(groupId);
CREATE INDEX IF NOT EXISTS idx_hole_group_archived ON hole_group(isArchived);

-- Group_Member indexes
CREATE INDEX IF NOT EXISTS idx_group_member_group ON group_member(groupId);
CREATE INDEX IF NOT EXISTS idx_group_member_member ON group_member(memberId);
CREATE INDEX IF NOT EXISTS idx_group_member_archived ON group_member(isArchived);

-- Hole_Club indexes
CREATE INDEX IF NOT EXISTS idx_hole_club_hole ON hole_club(holeId);
CREATE INDEX IF NOT EXISTS idx_hole_club_club ON hole_club(clubId);
CREATE INDEX IF NOT EXISTS idx_hole_club_archived ON hole_club(isArchived);

-- Hole_Scores indexes
CREATE INDEX IF NOT EXISTS idx_hole_scores_hole ON hole_scores(holeId);
CREATE INDEX IF NOT EXISTS idx_hole_scores_group ON hole_scores(groupId);
CREATE INDEX IF NOT EXISTS idx_hole_scores_archived ON hole_scores(isArchived);
CREATE INDEX IF NOT EXISTS idx_hole_scores_hole_group ON hole_scores(holeId, groupId);

-- =====================================
-- FUNCTION to update updated_at timestamp
-- =====================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================
-- TRIGGER for hole_scores updated_at
-- =====================================
CREATE TRIGGER update_hole_scores_updated_at
  BEFORE UPDATE ON hole_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- COMMENTS
-- =====================================
COMMENT ON TABLE event IS 'Golf events with name and date';
COMMENT ON TABLE holes IS 'Holes belonging to events';
COMMENT ON TABLE "group" IS 'Groups that play on specific holes (hole-specific)';
COMMENT ON TABLE member IS 'Golf players/members';
COMMENT ON TABLE hole_group IS 'Junction table: which groups play on which holes';
COMMENT ON TABLE group_member IS 'Junction table: which members belong to which groups';
COMMENT ON TABLE hole_club IS 'Junction table: which clubs are allowed on which holes';
COMMENT ON TABLE hole_scores IS 'Scores for each group on each hole';
COMMENT ON TABLE club IS 'Golf clubs';
COMMENT ON TABLE HoleDescription IS 'Descriptions for holes';


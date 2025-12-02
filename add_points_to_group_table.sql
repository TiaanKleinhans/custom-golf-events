-- Add points column to group table
-- Run this in your Supabase SQL Editor

ALTER TABLE "group" 
ADD COLUMN IF NOT EXISTS points decimal;

-- Add comment
COMMENT ON COLUMN "group".score IS 'Golf score (1-10) for this hole';
COMMENT ON COLUMN "group".points IS 'Calculated points (1-4) for this hole based on ranking';


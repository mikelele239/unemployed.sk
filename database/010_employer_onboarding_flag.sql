-- Migration: Add onboarding_complete flag to employers table
-- This prevents the employer portal from re-showing onboarding to existing users

-- Add onboarding_complete column (default false for existing rows)
ALTER TABLE employers ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Backfill: mark all employers who have filled in their profile as onboarding-complete
UPDATE employers
SET onboarding_complete = true
WHERE (industry IS NOT NULL OR description IS NOT NULL)
  AND location IS NOT NULL;

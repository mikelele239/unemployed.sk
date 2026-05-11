-- 18_match_scores_insights.sql
-- Add insights and executive_summary columns to match_scores
-- for the student-facing AI Match section on the For You page.

ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS executive_summary TEXT;

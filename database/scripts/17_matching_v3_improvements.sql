-- 17_matching_v3_improvements.sql
-- Phase 1+2: Match bands, eligibility tiers, trainable skills,
-- V2 criteria (hard gates, success factors, role templates), audit log.
-- Safe additive migration — no existing data modified.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Add V2 columns to job_match_criteria
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.job_match_criteria
  ADD COLUMN IF NOT EXISTS trainable_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role_family TEXT,
  ADD COLUMN IF NOT EXISTS role_level TEXT,
  ADD COLUMN IF NOT EXISTS hard_gates JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS success_factors JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS nice_to_haves TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS criteria_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS calibration_snapshot JSONB;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Add V3 fields to match_scores (match_band, eligibility_tier)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS match_band TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_tier TEXT DEFAULT 'eligible',
  ADD COLUMN IF NOT EXISTS criteria_version INTEGER DEFAULT 1;

-- Index for filtering by band and eligibility
CREATE INDEX IF NOT EXISTS idx_match_scores_band ON public.match_scores(match_band);
CREATE INDEX IF NOT EXISTS idx_match_scores_eligibility ON public.match_scores(eligibility_tier);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Criteria audit log (for compliance and transparency)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.criteria_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          BIGINT REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id     UUID,
  action          TEXT NOT NULL,
  criteria_snapshot JSONB NOT NULL,
  candidate_count_snapshot JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.criteria_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cal_service ON public.criteria_audit_log;
CREATE POLICY cal_service ON public.criteria_audit_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- AI Verification Interview Table
-- Migration: 009_ai_verification.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS cv_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session lifecycle
  status TEXT NOT NULL DEFAULT 'pending',
  -- Values: pending | in_progress | completed | failed

  -- Per-attribute evaluation results (JSONB)
  -- Shape per attribute key:
  -- {
  --   verified: bool,
  --   score: 0.0–1.0,
  --   level: "B2" | "intermediate" | "2 years hands-on" etc.,
  --   summary: "2-3 sentence evaluation",
  --   strengths: ["..."],
  --   gaps: ["..."],
  --   transcript: [{question, answer}],
  --   completed_at: ISO string
  -- }
  results JSONB NOT NULL DEFAULT '{}',

  -- Full chronological Q&A transcript
  -- Shape: [{role: "ai"|"student", text, attribute, timestamp, wasAudio?}]
  full_transcript JSONB NOT NULL DEFAULT '[]',

  -- Internal session state (for resuming in-progress interviews)
  -- Not exposed to employers
  session_state JSONB DEFAULT '{}',

  -- Aggregate 0.0–1.0 score across all attributes
  overall_score FLOAT,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One verification record per student
CREATE UNIQUE INDEX IF NOT EXISTS cv_verifications_user_id_idx ON cv_verifications (user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE cv_verifications ENABLE ROW LEVEL SECURITY;

-- Students can read their own verification record
CREATE POLICY "student_read_own_verification"
  ON cv_verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Students can insert their own verification (server does this via service key anyway)
CREATE POLICY "student_insert_own_verification"
  ON cv_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can update their own in-progress session
CREATE POLICY "student_update_own_verification"
  ON cv_verifications FOR UPDATE
  USING (auth.uid() = user_id);

-- NOTE: Employers read via server-side service role key (bypasses RLS),
-- after verifying the candidate has applied to their job.
-- No direct employer RLS needed here.

-- ── Auto-update updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_cv_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cv_verifications_updated_at
  BEFORE UPDATE ON cv_verifications
  FOR EACH ROW EXECUTE FUNCTION update_cv_verifications_updated_at();

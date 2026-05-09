-- 14_ai_matching.sql
-- AI Matching System v4 — profiles, criteria, scores.
-- Run this in your Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ai_profiles — Structured candidate profile (extended)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_profiles (
    user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Core identity
    full_name           TEXT,
    email               TEXT,
    phone               TEXT,
    location            TEXT,

    -- Skills (structured)
    hard_skills         TEXT[] DEFAULT '{}',
    soft_skills         TEXT[] DEFAULT '{}',
    languages           JSONB  DEFAULT '[]',
    certifications      TEXT[] DEFAULT '{}',

    -- Experience
    experience_years    SMALLINT DEFAULT 0,
    experience_level    TEXT DEFAULT 'unknown' CHECK (experience_level IN ('no_experience','beginner','junior','experienced','unknown')),
    work_experience     JSONB DEFAULT '[]',

    -- Education
    education_level     TEXT,
    education_field     TEXT,
    education_school    TEXT,
    graduation_year     SMALLINT,

    -- Preferences
    preferred_job_types   TEXT[] DEFAULT '{}',
    preferred_work_models TEXT[] DEFAULT '{}',
    preferred_locations   TEXT[] DEFAULT '{}',
    preferred_categories  TEXT[] DEFAULT '{}',
    min_salary            INTEGER,
    availability          TEXT CHECK (availability IN ('immediate','2_weeks','1_month','flexible') OR availability IS NULL),
    availability_hours    SMALLINT,
    work_mode_preference  TEXT CHECK (work_mode_preference IN ('remote','hybrid','on-site','any') OR work_mode_preference IS NULL),
    salary_expectation    INTEGER,

    -- Portfolio
    portfolio_links     TEXT[] DEFAULT '{}',

    -- AI-generated content (NOT visible to employers until approved)
    ai_headline             TEXT,
    ai_summary              TEXT,
    ai_portfolio_intro      TEXT,
    ai_strengths            TEXT[] DEFAULT '{}',
    ai_development_areas    TEXT[] DEFAULT '{}',
    ai_suggested_roles      TEXT[] DEFAULT '{}',
    ai_suggested_categories TEXT[] DEFAULT '{}',
    ai_missing_fields       TEXT[] DEFAULT '{}',
    ai_profile_quality_notes TEXT[] DEFAULT '{}',
    ai_normalized_skills    TEXT[] DEFAULT '{}',
    ai_profile_approved     BOOLEAN DEFAULT false,
    ai_generated_at         TIMESTAMPTZ,

    -- Profile completion
    profile_completion_score INTEGER DEFAULT 0,

    -- Parse metadata
    parse_status        TEXT DEFAULT 'pending' CHECK (parse_status IN ('pending','ready','needs_review','failed')),
    extraction_source   TEXT DEFAULT 'manual' CHECK (extraction_source IN ('cv_parse','manual','ai_llm')),
    extraction_version  TEXT DEFAULT '2.0',
    profile_version     INTEGER DEFAULT 1,
    raw_cv_text         TEXT,
    confidence_score    REAL DEFAULT 0.0,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_profiles_location ON public.ai_profiles(location);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_hard_skills ON public.ai_profiles USING GIN(hard_skills);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_education ON public.ai_profiles(education_level);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_status ON public.ai_profiles(parse_status);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_approved ON public.ai_profiles(ai_profile_approved);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. job_match_criteria — Structured requirements per job
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.job_match_criteria (
    job_id              BIGINT PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,

    required_skills     TEXT[] DEFAULT '{}',
    preferred_skills    TEXT[] DEFAULT '{}',

    min_education_level TEXT,
    preferred_fields    TEXT[] DEFAULT '{}',

    min_experience_years SMALLINT DEFAULT 0,
    required_experience_level TEXT,
    student_friendly    BOOLEAN DEFAULT true,
    no_experience_required BOOLEAN DEFAULT false,

    required_languages  JSONB DEFAULT '[]',

    work_model          TEXT,
    location_strict     BOOLEAN DEFAULT false,
    hours_per_week      SMALLINT,
    salary_min          INTEGER,
    salary_max          INTEGER,
    category            TEXT,

    team_size           TEXT,
    pace                TEXT,
    industry            TEXT,

    weight_skills       SMALLINT DEFAULT 30 CHECK (weight_skills BETWEEN 0 AND 100),
    weight_location     SMALLINT DEFAULT 15 CHECK (weight_location BETWEEN 0 AND 100),
    weight_job_type     SMALLINT DEFAULT 15 CHECK (weight_job_type BETWEEN 0 AND 100),
    weight_availability SMALLINT DEFAULT 10 CHECK (weight_availability BETWEEN 0 AND 100),
    weight_education    SMALLINT DEFAULT 10 CHECK (weight_education BETWEEN 0 AND 100),
    weight_experience   SMALLINT DEFAULT 10 CHECK (weight_experience BETWEEN 0 AND 100),
    weight_language     SMALLINT DEFAULT 5 CHECK (weight_language BETWEEN 0 AND 100),
    weight_salary       SMALLINT DEFAULT 3 CHECK (weight_salary BETWEEN 0 AND 100),
    weight_work_mode    SMALLINT DEFAULT 2 CHECK (weight_work_mode BETWEEN 0 AND 100),

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. match_scores — Pre-computed, server-written only
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.match_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id          BIGINT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

    eligible        BOOLEAN NOT NULL DEFAULT true,
    overall_score   INTEGER NOT NULL DEFAULT 0,
    breakdown       JSONB DEFAULT '{}',
    match_reasons   TEXT[] DEFAULT '{}',
    gaps            TEXT[] DEFAULT '{}',
    missing_required TEXT[] DEFAULT '{}',

    calculated_at   TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_match_scores_user ON public.match_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_job ON public.match_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_overall ON public.match_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_scores_eligible ON public.match_scores(eligible);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Patch profiles table
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ai_profile_ready  BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_cv_parsed_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. RLS Policies
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_match_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

-- ai_profiles: users can read own, service role can do all
DROP POLICY IF EXISTS ai_profiles_select_own ON public.ai_profiles;
CREATE POLICY ai_profiles_select_own ON public.ai_profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_profiles_update_own ON public.ai_profiles;
CREATE POLICY ai_profiles_update_own ON public.ai_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Employers can read approved profiles only
DROP POLICY IF EXISTS ai_profiles_employer_read ON public.ai_profiles;
CREATE POLICY ai_profiles_employer_read ON public.ai_profiles
    FOR SELECT USING (ai_profile_approved = true);

-- job_match_criteria: readable by all authenticated
DROP POLICY IF EXISTS jmc_select_all ON public.job_match_criteria;
CREATE POLICY jmc_select_all ON public.job_match_criteria
    FOR SELECT USING (auth.role() = 'authenticated');

-- match_scores: users can read own scores
DROP POLICY IF EXISTS ms_select_own ON public.match_scores;
CREATE POLICY ms_select_own ON public.match_scores
    FOR SELECT USING (auth.uid() = user_id);

-- Service role bypass (for server-side operations)
DROP POLICY IF EXISTS ai_profiles_service ON public.ai_profiles;
CREATE POLICY ai_profiles_service ON public.ai_profiles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS jmc_service ON public.job_match_criteria;
CREATE POLICY jmc_service ON public.job_match_criteria
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS ms_service ON public.match_scores;
CREATE POLICY ms_service ON public.match_scores
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

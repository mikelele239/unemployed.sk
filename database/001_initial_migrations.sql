-- ============================================================
-- unemployed.sk — Supabase SQL Migrations
-- Run these in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Employer Profiles table
-- Required for the Employer portal to store company info
CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  industry        text DEFAULT '',
  locations       text[] DEFAULT '{}',
  website         text DEFAULT '',
  logo_url        text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Employer can read/write their own profile
CREATE POLICY "Employer can manage own profile"
  ON public.employer_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add interview_dates column to applications if missing
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS interview_dates jsonb DEFAULT NULL;

-- 3. Add employer_id index on jobs for fast employer lookups
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON public.jobs(employer_id);

-- 4. Ensure profiles table has all needed columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_preferences text[] DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

-- 5. Make sure RLS allows anon INSERT on submissions (for landing page form)
-- (Run only if submissions table exists and anon insert is needed)
-- ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon insert" ON public.submissions FOR INSERT WITH CHECK (true);

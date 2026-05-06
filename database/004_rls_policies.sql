-- ============================================================
-- unemployed.sk — RLS Policies for Frontend Supabase Client
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Since we removed the Node backend proxy, all apps use the Supabase frontend client directly.
-- This means all operations use the "anon" key and MUST pass Row Level Security (RLS) policies.

-- ─── 1. JOBS Table ──────────────────────────────────────────────────────────
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active jobs (students need this for For You feed)
DROP POLICY IF EXISTS "Anyone can read jobs" ON public.jobs;
CREATE POLICY "Anyone can read jobs"
  ON public.jobs FOR SELECT
  USING (true);

-- Employers can insert jobs for themselves
DROP POLICY IF EXISTS "Employers can insert own jobs" ON public.jobs;
CREATE POLICY "Employers can insert own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

-- Employers can update their own jobs
DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;
CREATE POLICY "Employers can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);

-- Employers can delete their own jobs
DROP POLICY IF EXISTS "Employers can delete own jobs" ON public.jobs;
CREATE POLICY "Employers can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = employer_id);


-- ─── 2. APPLICATIONS Table ──────────────────────────────────────────────────
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Students can read their own applications
DROP POLICY IF EXISTS "Students can read own apps" ON public.applications;
CREATE POLICY "Students can read own apps"
  ON public.applications FOR SELECT
  USING (auth.uid() = student_id);

-- Employers can read applications for their own jobs
DROP POLICY IF EXISTS "Employers can read apps for own jobs" ON public.applications;
CREATE POLICY "Employers can read apps for own jobs"
  ON public.applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = applications.job_id
        AND jobs.employer_id = auth.uid()
    )
  );

-- Students can apply (insert)
DROP POLICY IF EXISTS "Students can insert own apps" ON public.applications;
CREATE POLICY "Students can insert own apps"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Employers can update applications (change status, add interview dates)
DROP POLICY IF EXISTS "Employers can update apps for own jobs" ON public.applications;
CREATE POLICY "Employers can update apps for own jobs"
  ON public.applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = applications.job_id
        AND jobs.employer_id = auth.uid()
    )
  );

-- ─── 3. EMPLOYERS Table ─────────────────────────────────────────────────────
-- Ensure the employers table is accessible
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read employers" ON public.employers;
CREATE POLICY "Anyone can read employers"
  ON public.employers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Employers can update own profile" ON public.employers;
CREATE POLICY "Employers can update own profile"
  ON public.employers FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── 4. PROFILES Table (Students) ───────────────────────────────────────────
-- Employers need to be able to read student profiles to see candidate names
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read student profiles" ON public.profiles;
CREATE POLICY "Anyone can read student profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- (Students can already manage their own profile, assuming existing policy)

-- ============================================================
-- FIX: Applications RLS - align column names
-- The applications table uses 'candidate_id' not 'student_id'
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Fix student SELECT policy (was using wrong column 'student_id')
DROP POLICY IF EXISTS "Students can read own apps" ON public.applications;
CREATE POLICY "Students can read own apps"
  ON public.applications FOR SELECT
  USING (auth.uid() = candidate_id);

-- Fix student INSERT policy (was using wrong column 'student_id')
DROP POLICY IF EXISTS "Students can insert own apps" ON public.applications;
CREATE POLICY "Students can insert own apps"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = candidate_id);

-- Ensure student UPDATE policy is correct too
DROP POLICY IF EXISTS "Students can update own apps" ON public.applications;
CREATE POLICY "Students can update own apps"
  ON public.applications FOR UPDATE
  USING (auth.uid() = candidate_id);

-- Re-confirm employer SELECT (already correct, but re-apply for safety)
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

-- Re-confirm employer UPDATE (already correct, but re-apply for safety)
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

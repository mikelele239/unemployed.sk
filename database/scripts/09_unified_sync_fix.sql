-- 09_unified_sync_fix.sql
-- Run this in your Supabase SQL Editor to unify the schema and fix synchronization issues.

-- 1. Fix job_views: Standardize schema
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_views' AND column_name='employer_id') THEN
    ALTER TABLE public.job_views ADD COLUMN employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_views' AND column_name='user_id') THEN
    ALTER TABLE public.job_views ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Fix employer_members: Ensure column is named 'role'
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employer_members' AND column_name='member_role') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employer_members' AND column_name='role') THEN
    ALTER TABLE public.employer_members RENAME COLUMN member_role TO role;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employer_members' AND column_name='role') THEN
    ALTER TABLE public.employer_members ADD COLUMN role TEXT DEFAULT 'admin';
  END IF;
END $$;

-- 3. Cleanup PERMISSIVE policies that might be blocking real RLS
DROP POLICY IF EXISTS "Enable all for anyone" ON public.applications;
DROP POLICY IF EXISTS "Anyone can insert job views" ON public.job_views;

-- 4. Harden employer_members RLS (CRITICAL for subqueries in other policies)
ALTER TABLE public.employer_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.employer_members;
CREATE POLICY "Members can view their own membership"
ON public.employer_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. Harden RLS for job_views
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employers can view their job views" ON public.job_views;
CREATE POLICY "Employers can view their job views"
ON public.job_views FOR SELECT TO authenticated
USING (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Insert job views" ON public.job_views;
CREATE POLICY "Insert job views"
ON public.job_views FOR INSERT TO authenticated, anon
WITH CHECK (true);

-- 6. Harden RLS for applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employers can view their applications" ON public.applications;
CREATE POLICY "Employers can view their applications"
ON public.applications FOR SELECT TO authenticated
USING (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
);

-- Allow students to see their own applications
DROP POLICY IF EXISTS "Candidates can view own applications" ON public.applications;
CREATE POLICY "Candidates can view own applications"
ON public.applications FOR SELECT TO authenticated
USING (candidate_id = auth.uid());

-- 7. Backfill & Relational integrity
UPDATE public.job_views v
SET employer_id = j.employer_id
FROM public.jobs j
WHERE v.job_id = j.id AND v.employer_id IS NULL;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_matches(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'Unified Sync Fix applied successfully.'; END $$;

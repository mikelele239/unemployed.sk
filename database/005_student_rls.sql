-- ============================================================
-- unemployed.sk — Student Profile + Storage RLS
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── Students can INSERT their own profile ──────────────────────────────────
DROP POLICY IF EXISTS "Students can insert own profile" ON public.profiles;
CREATE POLICY "Students can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Students can UPDATE their own profile ──────────────────────────────────
DROP POLICY IF EXISTS "Students can update own profile" ON public.profiles;
CREATE POLICY "Students can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Students can INSERT their own applications ─────────────────────────────
-- (May already exist from 004, but idempotent with DROP IF EXISTS)
DROP POLICY IF EXISTS "Students can insert own apps" ON public.applications;
CREATE POLICY "Students can insert own apps"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = candidate_id);

-- ─── Students can UPDATE their own applications (e.g. decline interview) ────
DROP POLICY IF EXISTS "Students can update own apps" ON public.applications;
CREATE POLICY "Students can update own apps"
  ON public.applications FOR UPDATE
  USING (auth.uid() = candidate_id);

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

-- ─── Job Views: anyone authenticated can insert ─────────────────────────────
-- (Drop old policies from 003 migration first)
DROP POLICY IF EXISTS "Users can insert views" ON public.job_views;
DROP POLICY IF EXISTS "Employers can read views" ON public.job_views;
DROP POLICY IF EXISTS "Anyone can insert views" ON public.job_views;
DROP POLICY IF EXISTS "Anyone can read views" ON public.job_views;

CREATE POLICY "Anyone can insert views"
  ON public.job_views FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can read views"
  ON public.job_views FOR SELECT
  USING (true);

-- ─── Job Likes: authenticated users can like/unlike ─────────────────────────
-- (Drop old policies from 003 migration first)
DROP POLICY IF EXISTS "Users can insert likes" ON public.job_likes;
DROP POLICY IF EXISTS "Users can delete likes" ON public.job_likes;
DROP POLICY IF EXISTS "Employers can read likes" ON public.job_likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.job_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.job_likes;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.job_likes;

CREATE POLICY "Users can insert own likes"
  ON public.job_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON public.job_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read likes"
  ON public.job_likes FOR SELECT
  USING (true);

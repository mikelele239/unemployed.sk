-- ============================================================
-- Security Hardening Migration
-- Migration: 011_security_hardening.sql
-- Date: 2026-05-31
-- Purpose: Fix Critical and High RLS vulnerabilities found in security audit
-- ============================================================

BEGIN;

-- ============================================================
-- C-3: Student profiles readable by ANYONE
-- Old policy allowed unrestricted SELECT on public.profiles.
-- Fix: Restrict to own profile + employers viewing applicants.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Employers read applicant profiles" ON public.profiles;

-- Students can read their own profile
CREATE POLICY "Students read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Employers can read profiles of candidates who applied to their jobs
CREATE POLICY "Employers read applicant profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.candidate_id = profiles.user_id
        AND j.employer_id = auth.uid()
    )
  );

-- ============================================================
-- C-6: Notifications INSERT allows injection to any user
-- Old policy allowed inserting notifications for arbitrary users.
-- Fix: Users can only insert notifications for themselves.
-- ============================================================

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

-- Users can only create notifications for themselves (system creates via service role)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- H-2: Missing WITH CHECK on application UPDATE policies
-- Old policies had USING but no WITH CHECK, allowing row
-- ownership to be transferred on UPDATE.
-- Fix: Add WITH CHECK mirroring USING on both policies.
-- ============================================================

DROP POLICY IF EXISTS "Students can update own apps" ON public.applications;
CREATE POLICY "Students can update own apps"
  ON public.applications FOR UPDATE
  USING (auth.uid() = candidate_id)
  WITH CHECK (auth.uid() = candidate_id);

DROP POLICY IF EXISTS "Employers can update apps for own jobs" ON public.applications;
CREATE POLICY "Employers can update apps for own jobs"
  ON public.applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = applications.job_id
        AND jobs.employer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = applications.job_id
        AND jobs.employer_id = auth.uid()
    )
  );

-- ============================================================
-- H-7: Job views INSERT policy allows any authenticated user
-- Old policy let any user insert views attributed to others.
-- Fix: Users can only insert views for themselves.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert views" ON public.job_views;
CREATE POLICY "Users can insert own views"
  ON public.job_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- H-1: Employer profiles readable by anyone (incl. anonymous)
-- Fix: Require authentication; employers always see own profile.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read employers" ON public.employers;
DROP POLICY IF EXISTS "Authenticated users read employer info" ON public.employers;
DROP POLICY IF EXISTS "Employers read own full profile" ON public.employers;

-- Authenticated users can read employer public info
CREATE POLICY "Authenticated users read employer info"
  ON public.employers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Employers can always read their own full profile
CREATE POLICY "Employers read own full profile"
  ON public.employers FOR SELECT
  USING (auth.uid() = id);

-- ============================================================
-- POST-AUDIT CLEANUP: Dangerous leftover policies found during
-- live Supabase RLS inspection (2026-05-31)
-- ============================================================

-- 🔴 CRITICAL: "Service can insert notifications" uses role {public} with
-- WITH CHECK (true), completely bypassing the ownership-based insert policy.
-- Permissive policies in Postgres use OR logic, so this one nullifies the fix.
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- 🔴 HIGH: "Allow service select submissions" uses role {public} with USING(true),
-- meaning ANY anonymous user can read all form submissions (emails, phone numbers).
DROP POLICY IF EXISTS "Allow service select submissions" ON public.submissions;
CREATE POLICY "Service can read submissions"
  ON public.submissions FOR SELECT TO service_role
  USING (true);

-- 🟡 MEDIUM: Residual "employers_public_read" was NOT dropped in the original
-- migration — it still allows anon+authenticated to read all employer data.
DROP POLICY IF EXISTS "employers_public_read" ON public.employers;

-- 🟢 LOW: Duplicate "Anyone can read jobs" — keep only "Allow public read jobs"
DROP POLICY IF EXISTS "Anyone can read jobs" ON public.jobs;

-- 🟢 LOW: "Anyone can read likes/views" — restricting to users with more
-- specific policies already present (own likes, employer likes on own jobs).
DROP POLICY IF EXISTS "Anyone can read likes" ON public.job_likes;
DROP POLICY IF EXISTS "Anyone can read views" ON public.job_views;

COMMIT;

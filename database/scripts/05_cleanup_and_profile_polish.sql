-- 05_cleanup_and_profile_polish.sql
-- 1. CLEANUP: Wipe mock data
TRUNCATE public.jobs CASCADE;
TRUNCATE public.applications CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.submissions CASCADE;
TRUNCATE public.employers CASCADE;

-- 2. PROFILE EXPANSION
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS job_preferences JSONB DEFAULT '[]'::jsonb;

-- 3. RLS POLICIES FOR PROFILES
-- Ensure authenticated users can insert their own profile if it doesn't exist
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure authenticated users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Ensure any authenticated user can view other profiles (for employer view)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 4. RLS POLICIES FOR APPLICATIONS (Hardening)
DROP POLICY IF EXISTS "Candidates can insert own applications" ON public.applications;
CREATE POLICY "Candidates can insert own applications" ON public.applications 
FOR INSERT WITH CHECK (
  auth.uid() = candidate_id AND 
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'candidate'
);

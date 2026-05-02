-- 06_complete_schema.sql
-- Run this in your Supabase SQL Editor to complete the production environment.

-- ── 1. Create missing identity tables ──────────────────────────────────────────

-- User Roles: Ensures every auth user has a strictly defined app-level role.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('candidate', 'employer', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles: Stores rich candidate data.
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    bio TEXT,
    education TEXT,
    location TEXT,
    skills TEXT[] DEFAULT '{}',
    job_preferences TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Create missing functional tables ────────────────────────────────────────

-- Employers: Stores company metadata.
CREATE TABLE IF NOT EXISTS public.employers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employer Members: Links auth users to companies with a specific permission level.
CREATE TABLE IF NOT EXISTS public.employer_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employer_id, user_id)
);

-- User CVs: Metadata for resumes stored in Supabase Storage.
CREATE TABLE IF NOT EXISTS public.user_cvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ── 3. Patch existing tables with status tracking & missing FKs ───────────────

ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS employer_id  UUID REFERENCES public.employers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending' 
  CHECK (status IN ('Pending', 'Viewed', 'Interview', 'Hired', 'Rejected'));

CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer_id  ON public.applications(employer_id);

-- ── 4. Patch jobs table with missing production columns ───────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS employer_id  UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lat          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS duration     TEXT,
  ADD COLUMN IF NOT EXISTS start_date   TEXT,
  ADD COLUMN IF NOT EXISTS work_model   TEXT,
  ADD COLUMN IF NOT EXISTS rate_unit    TEXT DEFAULT '/hod';

CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON public.jobs(employer_id);


-- ── 4. Automate Role Assignment (Triggers) ────────────────────────────────────

-- Automatically assigns the role from user_metadata to the user_roles table on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'candidate'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ── 5. Supporting RPC Helpers ────────────────────────────────────────────────

-- get_user_role: Used by the backend to verify app-level roles (candidate/employer)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO service_role;

-- get_employer_analytics: Aggregates pipeline stats for the employer dashboard
CREATE OR REPLACE FUNCTION public.get_employer_analytics(target_employer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_views', (SELECT COUNT(*) FROM public.job_views v JOIN public.jobs j ON v.job_id = j.id WHERE j.employer_id = target_employer_id),
    'total_applications', (SELECT COUNT(*) FROM public.applications WHERE employer_id = target_employer_id),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE employer_id = target_employer_id),
    'pipeline_stats', (
      SELECT jsonb_object_agg(status, count) FROM (
        SELECT status, COUNT(*) as count 
        FROM public.applications 
        WHERE employer_id = target_employer_id 
        GROUP BY status
      ) s
    ),
    'recent_views_trend', (
      SELECT jsonb_agg(d.cnt) FROM (
        SELECT COUNT(*) as cnt 
        FROM generate_series(now() - interval '6 days', now(), '1 day') AS day
        LEFT JOIN public.job_views v ON date_trunc('day', v.created_at) = date_trunc('day', day)
        JOIN public.jobs j ON v.job_id = j.id
        WHERE j.employer_id = target_employer_id
        GROUP BY day ORDER BY day
      ) d
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_analytics(UUID) TO authenticated;

-- get_employer_matches: Skill-matching engine for proactive candidate search
CREATE OR REPLACE FUNCTION public.get_employer_matches(target_employer_id UUID)
RETURNS TABLE (
  student_id UUID,
  first_name TEXT,
  last_name TEXT,
  skills TEXT[],
  location TEXT,
  match_score INTEGER,
  matched_job_title TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH employer_skills AS (
    SELECT id as job_id, title, (regexp_split_to_array(lower(requirements), ',\s*')) as req_array, location as job_loc
    FROM public.jobs 
    WHERE employer_id = target_employer_id
  )
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.skills,
    p.location,
    (
      -- Basic scoring: 50 points for location match, 10 per skill overlap
      (CASE WHEN lower(p.location) = lower(es.job_loc) THEN 50 ELSE 0 END) +
      (SELECT COUNT(*) * 10 FROM unnest(p.skills) s WHERE lower(s) = ANY(es.req_array))::INTEGER
    ) as score,
    es.title
  FROM public.profiles p
  CROSS JOIN employer_skills es
  WHERE 
    (p.skills && es.req_array) -- Must have at least one skill overlap
    OR lower(p.location) = lower(es.job_loc)
  ORDER BY score DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_matches(UUID) TO authenticated;

-- ── 6. Enable RLS and define remaining policies ───────────────────────────────

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;

-- User Roles: Users can read their own role.
DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Profiles: Candidates manage their own. Employers read if the candidate applied to their job.
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles 
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Employers read applicant profiles" ON public.profiles;
CREATE POLICY "Employers read applicant profiles" ON public.profiles
  FOR SELECT USING (
    user_id IN (
      SELECT candidate_id FROM public.applications 
      WHERE employer_id IN (
        SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
      )
    )
  );

-- CVs: Candidates manage their own. Employers read if the candidate applied.
DROP POLICY IF EXISTS "Users manage own CVs" ON public.user_cvs;
CREATE POLICY "Users manage own CVs" ON public.user_cvs 
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Employers read applicant CVs" ON public.user_cvs;
CREATE POLICY "Employers read applicant CVs" ON public.user_cvs
  FOR SELECT USING (
    user_id IN (
      SELECT candidate_id FROM public.applications 
      WHERE employer_id IN (
        SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── 7. Storage Bucket & Policies ─────────────────────────────────────────────

-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-cvs', 'user-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Candidates can upload their own CVs (path begins with their user_id)
DROP POLICY IF EXISTS "Candidates can upload own CVs" ON storage.objects;
CREATE POLICY "Candidates can upload own CVs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Candidates can read/manage their own CVs
DROP POLICY IF EXISTS "Candidates manage own CV objects" ON storage.objects;
CREATE POLICY "Candidates manage own CV objects"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'user-cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Employers can read CVs of applicants to their jobs
-- This allows the server to generate signed URLs on behalf of the employer.
DROP POLICY IF EXISTS "Employers read applicant CV objects" ON storage.objects;
CREATE POLICY "Employers read applicant CV objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-cvs' AND
  (storage.foldername(name))[1] IN (
    SELECT candidate_id::text FROM public.applications
    WHERE employer_id IN (
      SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
    )
  )
);

-- ── 8. Cleanup Logic (Optional: TRUNCATE for clean slate) ─────────────────────
/*
TRUNCATE public.job_views RESTART IDENTITY CASCADE;
TRUNCATE public.applications RESTART IDENTITY CASCADE;
TRUNCATE public.jobs RESTART IDENTITY CASCADE;
TRUNCATE public.employer_members RESTART IDENTITY CASCADE;
TRUNCATE public.employers RESTART IDENTITY CASCADE;
TRUNCATE public.profiles RESTART IDENTITY CASCADE;
TRUNCATE public.user_roles RESTART IDENTITY CASCADE;
TRUNCATE public.submissions RESTART IDENTITY CASCADE;
*/

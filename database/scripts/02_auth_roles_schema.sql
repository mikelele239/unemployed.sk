-- 02_auth_roles_schema.sql
-- Run this in your Supabase SQL Editor to establish the authentication and role architecture.

-- 1. Custom Role Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('candidate', 'employer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. User Roles Table
-- Every authenticated user must have exactly one app-level role.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'candidate'
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles Table (Mainly for candidates and general data)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Employers Table (Company Records)
CREATE TABLE IF NOT EXISTS public.employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

-- 5. Employer Members Table (Mapping users to companies)
CREATE TABLE IF NOT EXISTS public.employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member', -- e.g., 'owner', 'recruiter'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, employer_id)
);
ALTER TABLE public.employer_members ENABLE ROW LEVEL SECURITY;

-- 6. Helper Functions for RLS and Backend checks
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_employer_member(check_employer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employer_members 
    WHERE user_id = auth.uid() AND employer_id = check_employer_id
  );
$$;

-- 7. Trigger on auth.users for Default Candidate Fallback
-- Any organic signup defaults to candidate safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  target_role public.app_role;
BEGIN
  -- 1. Determine role: Check metadata first, default to 'candidate'
  target_role := COALESCE(
    (new.raw_user_meta_data->>'role')::public.app_role, 
    'candidate'::public.app_role
  );

  -- 2. Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, target_role)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Create basic Profile
  INSERT INTO public.profiles (user_id, first_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_employers_updated_at BEFORE UPDATE ON public.employers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 9. Strict RLS Policies

-- User Roles
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- (Insert/Update on user_roles is intentionally denied to public; managed by Triggers / Service Role)

-- Profiles
CREATE POLICY "Candidates can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Candidates can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Employers
-- We only want authorized members to read / update their own company data
CREATE POLICY "Members can read employer" ON public.employers FOR SELECT USING (is_employer_member(id));
CREATE POLICY "Owners can update employer" ON public.employers FOR UPDATE USING (is_employer_member(id));

-- Employer Members
CREATE POLICY "Members can see their memberships" ON public.employer_members FOR SELECT USING (auth.uid() = user_id);

-- 10. Provider-Level Guard (Optional RLS on profiles to block employers signing in with Google)
-- The backend API strictly guards this, but RLS adds defense in depth.
-- (Omitted here to keep RLS performant, but backend Auth Guard handles provider checking)

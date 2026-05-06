-- 008_public_employer_read.sql
-- Allow anyone (including students) to read basic employer info.
-- This is needed so the student portal's Search page and CompanyProfile
-- page can display registered companies.

-- Add a public read policy for the employers table
DROP POLICY IF EXISTS "Anyone can read employers" ON public.employers;
CREATE POLICY "Anyone can read employers"
  ON public.employers FOR SELECT
  USING (true);

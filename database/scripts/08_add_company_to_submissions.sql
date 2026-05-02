-- 08_add_company_to_submissions.sql
-- Adds company_name to the submissions table for employer leads

ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Update RLS to ensure public can insert into this table (usually already true from setup)
DROP POLICY IF EXISTS "Allow public insert submissions" ON public.submissions;
CREATE POLICY "Allow public insert submissions" ON public.submissions FOR INSERT WITH CHECK (true);

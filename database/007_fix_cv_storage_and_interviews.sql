-- ============================================================
-- FIX: Storage policies for CVs + interview_dates column
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Add interview_dates and selected_date columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_dates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_date TIMESTAMPTZ;

-- 2. Relax the status CHECK constraint to allow more statuses
-- First drop existing constraint if any
DO $$
BEGIN
  ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check 
  CHECK (status IN ('Pending', 'Viewed', 'Interview', 'Interview-Confirmed', 'Hired', 'Rejected', 'Declined'))
  NOT VALID;

-- 3. Fix storage policies for the 'cvs' bucket
-- The app uses bucket 'cvs', not 'user-cvs'

-- Allow any authenticated user to read CVs (employers need to view applicant CVs)
DROP POLICY IF EXISTS "Anyone authenticated can read CVs" ON storage.objects;
CREATE POLICY "Anyone authenticated can read CVs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cvs');

-- Candidates can upload their own CVs
DROP POLICY IF EXISTS "Candidates upload own CVs" ON storage.objects;
CREATE POLICY "Candidates upload own CVs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Candidates can delete their own CVs
DROP POLICY IF EXISTS "Candidates delete own CVs" ON storage.objects;
CREATE POLICY "Candidates delete own CVs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Run this in your Supabase SQL Editor to support the MVP fields.

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS duration TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS work_model TEXT; -- e.g., 'On-site', 'Hybrid', 'Remote'

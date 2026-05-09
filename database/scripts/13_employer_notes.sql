-- 13_employer_notes.sql
-- Adds employer_notes column to applications table
-- Run this in Supabase SQL Editor

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS employer_notes TEXT;

-- Allow employers to update their notes (via service role in server.js)
-- No RLS changes needed since server uses service role key

-- 03_cv_storage_and_metadata.sql
-- Run this in your Supabase SQL Editor to establish secure CV Storage and Postgres Metadata.

-- 1. Create user_cvs metadata table
CREATE TABLE IF NOT EXISTS public.user_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'deleted'
  consent_version TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_cvs_user_id ON public.user_cvs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cvs_status ON public.user_cvs(status);

-- Enable RLS
ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;

-- Candidates control their own active CVs
CREATE POLICY "Candidates can read own CVs" ON public.user_cvs 
FOR SELECT USING (auth.uid() = user_id AND get_user_role() = 'candidate' AND status = 'active');

CREATE POLICY "Candidates can insert own CVs" ON public.user_cvs 
FOR INSERT WITH CHECK (auth.uid() = user_id AND get_user_role() = 'candidate');

CREATE POLICY "Candidates can update own CVs" ON public.user_cvs 
FOR UPDATE USING (auth.uid() = user_id AND get_user_role() = 'candidate');

-- (Deleting will be a soft-delete update to status = 'deleted' via API)

-- RLS Update trigger
CREATE TRIGGER update_user_cvs_updated_at 
BEFORE UPDATE ON public.user_cvs 
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 2. Storage Setup
-- First, ensure the 'user-cvs' bucket exists. Since creating buckets via raw SQL without 
-- hitting the storage schema can be finicky depending on your Supabase version,
-- it is officially recommended to run this logic using the dashboard or via API.
-- However, we can attempt native insertion if storage.buckets exists:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-cvs', 
  'user-cvs', 
  false, 
  10485760, -- 10MB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage Policies 
-- Auth.uid() guarantees ownership, folder structure guarantees isolation
CREATE POLICY "Users can upload their own CV files" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'user-cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own CV files" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'user-cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own CV files" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'user-cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

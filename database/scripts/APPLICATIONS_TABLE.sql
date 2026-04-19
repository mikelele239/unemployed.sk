-- Run this in your Supabase SQL Editor to create the applications table

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id BIGINT REFERENCES public.jobs(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_profile JSONB,   -- { school, field, bio }
  ai_score INTEGER,        -- 0 to 100
  ai_reasoning TEXT,       -- Simulated reasoning
  status TEXT DEFAULT 'pending', -- 'pending', 'contacted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and simple policies
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anyone" ON public.applications FOR ALL USING (true) WITH CHECK (true);

-- Update ai_profiles extraction_source check to support new values
ALTER TABLE public.ai_profiles DROP CONSTRAINT IF EXISTS ai_profiles_extraction_source_check;
ALTER TABLE public.ai_profiles ADD CONSTRAINT ai_profiles_extraction_source_check 
  CHECK (extraction_source IN ('cv_parse','manual','ai_llm','openai_gpt4o_mini','rule_based'));

-- Update experience_level check to support new values
ALTER TABLE public.ai_profiles DROP CONSTRAINT IF EXISTS ai_profiles_experience_level_check;
ALTER TABLE public.ai_profiles ADD CONSTRAINT ai_profiles_experience_level_check
  CHECK (experience_level IN ('no_experience','beginner','entry','junior','mid','experienced','senior','unknown'));

-- Add preferred_work_locations if not exists (for AI-inferred locations)
ALTER TABLE public.ai_profiles ADD COLUMN IF NOT EXISTS preferred_work_locations TEXT[] DEFAULT '{}';

-- Add matching preference columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_model_preference TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_hours SMALLINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_expectation INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_preferences JSONB DEFAULT '[]';

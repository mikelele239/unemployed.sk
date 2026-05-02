-- 10_enhanced_dashboard_analytics.sql
-- Run this in your Supabase SQL Editor.

-- 1. Ensure applications table has all modern columns used by server.js
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='student_name') THEN
    ALTER TABLE public.applications ADD COLUMN student_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='student_email') THEN
    ALTER TABLE public.applications ADD COLUMN student_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='student_profile') THEN
    ALTER TABLE public.applications ADD COLUMN student_profile JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='ai_score') THEN
    ALTER TABLE public.applications ADD COLUMN ai_score INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='ai_reasoning') THEN
    ALTER TABLE public.applications ADD COLUMN ai_reasoning TEXT;
  END IF;
END $$;

-- 2. Update the Analytics function to provide real data for the dashboard
CREATE OR REPLACE FUNCTION public.get_employer_analytics(target_employer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_views', (SELECT COUNT(*) FROM public.job_views v JOIN public.jobs j ON v.job_id = j.id WHERE j.employer_id = target_employer_id),
    'total_applications', (SELECT COUNT(*) FROM public.applications WHERE employer_id = target_employer_id),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE employer_id = target_employer_id),
    'avg_match_score', (SELECT COALESCE(ROUND(AVG(ai_score)), 0) FROM public.applications WHERE employer_id = target_employer_id),
    'pipeline_stats', (
      SELECT jsonb_object_agg(status, count) FROM (
        SELECT status, COUNT(*) as count 
        FROM public.applications 
        WHERE employer_id = target_employer_id 
        GROUP BY status
      ) s
    ),
    'recent_candidates', (
      SELECT COALESCE(jsonb_agg(cand), '[]'::jsonb) FROM (
        SELECT 
          id,
          student_name,
          student_email,
          ai_score,
          created_at,
          (SELECT title FROM public.jobs WHERE id = job_id) as job_title
        FROM public.applications
        WHERE employer_id = target_employer_id
        ORDER BY created_at DESC
        LIMIT 5
      ) cand
    ),
    'recent_views_trend', (
      SELECT jsonb_agg(d.cnt) FROM (
        SELECT COUNT(*) as cnt 
        FROM generate_series(now() - interval '6 days', now(), '1 day') AS day
        LEFT JOIN public.job_views v ON date_trunc('day', v.created_at) = date_trunc('day', day)
        AND v.employer_id = target_employer_id
        GROUP BY day ORDER BY day
      ) d
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_analytics(UUID) TO authenticated;

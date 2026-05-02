-- 05_analytics_ai_matches.sql
-- Refined for actual application trends and matching.

-- 1. Analytics Helper Function (UPDATED)
CREATE OR REPLACE FUNCTION public.get_employer_analytics(target_employer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_views', (SELECT COUNT(*) FROM public.job_views v JOIN public.jobs j ON v.job_id = j.id WHERE j.employer_id = target_employer_id),
    'total_applications', (SELECT COUNT(*) FROM public.applications WHERE employer_id = target_employer_id),
    'active_jobs', (SELECT COUNT(*) FROM public.jobs WHERE employer_id = target_employer_id),
    'avg_match_score', (SELECT COALESCE(AVG(ai_score), 0)::INTEGER FROM public.applications WHERE employer_id = target_employer_id),
    'pipeline_stats', (
      SELECT jsonb_object_agg(lower(status), count) FROM (
        SELECT status, COUNT(*) as count 
        FROM public.applications 
        WHERE employer_id = target_employer_id 
        GROUP BY status
      ) s
    ),
    'recent_apps_trend', (
      -- Corrected join to ensure zero days are included
      SELECT jsonb_agg(d.cnt) FROM (
        SELECT COALESCE(sub.cnt, 0) as cnt
        FROM generate_series(now()::date - interval '6 days', now()::date, '1 day') AS day
        LEFT JOIN (
           SELECT date_trunc('day', created_at) as dt, COUNT(*) as cnt
           FROM public.applications
           WHERE employer_id = target_employer_id
           GROUP BY dt
        ) sub ON sub.dt = day
        ORDER BY day
      ) d
    ),
    'recent_candidates', (
      SELECT jsonb_agg(cand) FROM (
        SELECT id, student_name, student_email, ai_score, created_at, job_title
        FROM public.applications
        WHERE employer_id = target_employer_id
        ORDER BY created_at DESC
        LIMIT 5
      ) cand
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

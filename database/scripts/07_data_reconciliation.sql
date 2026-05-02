-- ── Reconciliation: Link homeless data to the master employer ─────────────

DO $$
DECLARE
  target_emp_id UUID;
BEGIN
  -- 1. Identify the primary developer employer account
  SELECT id INTO target_emp_id FROM public.employers LIMIT 1;
  
  IF target_emp_id IS NOT NULL THEN
    -- 2. Backfill missing employer_id in Jobs
    UPDATE public.jobs 
    SET employer_id = target_emp_id 
    WHERE employer_id IS NULL;
    
    -- 3. Backfill missing employer_id in Job Views
    -- We join with jobs table to find the correct employer for each view
    UPDATE public.job_views v
    SET employer_id = j.employer_id
    FROM public.jobs j
    WHERE v.job_id = j.id 
    AND v.employer_id IS NULL;

    -- 4. Backfill missing employer_id in Applications
    UPDATE public.applications a
    SET employer_id = j.employer_id
    FROM public.jobs j
    WHERE a.job_id = j.id 
    AND a.employer_id IS NULL;

    -- 5. Safety catch for applications where job might be deleted
    UPDATE public.applications
    SET employer_id = target_emp_id
    WHERE employer_id IS NULL;

    RAISE NOTICE 'Reconciliation complete for employer %', target_emp_id;
  ELSE
    RAISE NOTICE 'Skipping: No employer found in database.';
  END IF;
END $$;

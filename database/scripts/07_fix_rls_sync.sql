-- 1. Applications: Allow employers to READ applications for their jobs
DROP POLICY IF EXISTS "Employers can view their applications" ON public.applications;
CREATE POLICY "Employers can view their applications"
ON public.applications
FOR SELECT
TO authenticated
USING (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
);

-- 2. Job Views: Allow employers to READ analytics for their jobs
DROP POLICY IF EXISTS "Employers can view their job views" ON public.job_views;
CREATE POLICY "Employers can view their job views"
ON public.job_views
FOR SELECT
TO authenticated
USING (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
);

-- 3. Applications: Allow employers to UPDATE application status (e.g. Reject/Contact)
DROP POLICY IF EXISTS "Employers can update application status" ON public.applications;
CREATE POLICY "Employers can update application status"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  employer_id IN (
    SELECT employer_id FROM public.employer_members WHERE user_id = auth.uid()
  )
);

-- 4. Verify employer_members RLS (Ensures user can read their own membership)
DROP POLICY IF EXISTS "Users can read own membership" ON public.employer_members;
CREATE POLICY "Users can read own membership"
ON public.employer_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

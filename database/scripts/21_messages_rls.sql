-- 21_messages_rls.sql
-- Enables RLS on application_messages and sets up secure select policies for candidate and employer.

-- =========================================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- =========================================================================
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. CREATE POLICIES
-- =========================================================================

-- Allow users to read messages for applications they are part of
DROP POLICY IF EXISTS "Users can read their own application messages" ON public.application_messages;
CREATE POLICY "Users can read their own application messages" ON public.application_messages
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            -- 1. Check if the authenticated user is the candidate of the application
            EXISTS (
                SELECT 1 FROM public.applications 
                WHERE id = application_id AND candidate_id = auth.uid()
            )
            OR
            -- 2. Check if the authenticated user is the employer owner
            EXISTS (
                SELECT 1 FROM public.applications 
                WHERE id = application_id AND employer_id = auth.uid()
            )
            OR
            -- 3. Check if the authenticated user is a member of the employer company
            EXISTS (
                SELECT 1 FROM public.employer_members 
                WHERE user_id = auth.uid() AND employer_id = (
                    SELECT employer_id FROM public.applications WHERE id = application_id
                )
            )
        )
    );

-- Allow backend (service role) full access (bypasses RLS anyway, but here for documentation & completeness)
DROP POLICY IF EXISTS "Service role has full access" ON public.application_messages;
CREATE POLICY "Service role has full access" ON public.application_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

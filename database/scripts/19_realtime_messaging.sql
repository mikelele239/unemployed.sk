-- 19_realtime_messaging.sql
-- Run this in your Supabase SQL Editor to create the real-time messaging tables, security policies, and automation triggers.

-- =========================================================================
-- 1. CLEANUP (Drop existing to avoid conflicts if re-running)
-- =========================================================================
DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
DROP TRIGGER IF EXISTS on_application_status_changed ON public.applications;
DROP FUNCTION IF EXISTS public.handle_message_inserted();
DROP FUNCTION IF EXISTS public.handle_application_status_message();
DROP FUNCTION IF EXISTS public.can_access_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_employer_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid);

-- =========================================================================
-- 2. CREATE TABLES
-- =========================================================================

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
    job_id BIGINT REFERENCES public.jobs(id) ON DELETE SET NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('application', 'job_question', 'candidate_invite', 'interview', 'support')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant_role TEXT NOT NULL CHECK (participant_role IN ('candidate', 'employer', 'admin', 'system')),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL represents a system message
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'application_update', 'interview_invite')),
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- NULL means not deleted (soft delete)
);

-- =========================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_conversations_employer_id ON public.conversations(employer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_application_id ON public.conversations(application_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- =========================================================================
-- 4. POSTGRES HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS circular loops)
-- =========================================================================

-- Helper to check if a user is a participant in a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    );
$$;

-- Helper to check if a user is a member of an employer/company
CREATE OR REPLACE FUNCTION public.is_employer_member(p_employer_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.employer_members
        WHERE employer_id = p_employer_id AND user_id = p_user_id
    );
$$;

-- Unified access control function
CREATE OR REPLACE FUNCTION public.can_access_conversation(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role TEXT;
    v_employer_id UUID;
BEGIN
    -- 1. Must be a participant in the conversation
    IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
        RETURN FALSE;
    END IF;

    -- 2. Fetch the user's role from user_roles
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = p_user_id;

    -- 3. Admin / Candidates only need to pass the participant check
    IF v_role = 'candidate' OR v_role = 'admin' THEN
        RETURN TRUE;
    ELSIF v_role = 'employer' THEN
        -- 4. Employer users must ALSO belong to the company that owns the conversation
        SELECT employer_id INTO v_employer_id FROM public.conversations WHERE id = p_conversation_id;
        RETURN public.is_employer_member(v_employer_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- =========================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND public.can_access_conversation(id, auth.uid())
    );

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            -- If employer, must belong to the employer company
            (public.get_user_role() = 'employer' AND public.is_employer_member(employer_id, auth.uid()))
            OR 
            -- Candidates can create conversations (e.g. for applications or job questions)
            (public.get_user_role() = 'candidate')
        )
    );

DROP POLICY IF EXISTS "Participants can update conversation details" ON public.conversations;
CREATE POLICY "Participants can update conversation details" ON public.conversations
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND public.can_access_conversation(id, auth.uid())
    );

-- Conversation Participants policies
DROP POLICY IF EXISTS "Participants can view participant list" ON public.conversation_participants;
CREATE POLICY "Participants can view participant list" ON public.conversation_participants
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND public.can_access_conversation(conversation_id, auth.uid())
    );

DROP POLICY IF EXISTS "Authenticated users can join/add to participant list" ON public.conversation_participants;
CREATE POLICY "Authenticated users can join/add to participant list" ON public.conversation_participants
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "Users can update their own participant metadata" ON public.conversation_participants;
CREATE POLICY "Users can update their own participant metadata" ON public.conversation_participants
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND auth.uid() = user_id
    );

-- Messages policies
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND public.can_access_conversation(conversation_id, auth.uid())
    );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = sender_id 
        AND public.can_access_conversation(conversation_id, auth.uid())
        -- Prevent clients from spoofing system/application-update message types
        AND message_type NOT IN ('system', 'application_update')
    );

DROP POLICY IF EXISTS "Senders can update/delete their own messages" ON public.messages;
CREATE POLICY "Senders can update/delete their own messages" ON public.messages
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND auth.uid() = sender_id
    );

-- =========================================================================
-- 6. AUTOMATION TRIGGERS
-- =========================================================================

-- Trigger to update conversation's last_message_at and updated_at on new message
CREATE OR REPLACE FUNCTION public.handle_message_inserted()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_message_inserted();

-- Trigger to create system messages when applications status changes
CREATE OR REPLACE FUNCTION public.handle_application_status_message()
RETURNS TRIGGER AS $$
DECLARE
    v_conv_id UUID;
    v_system_msg TEXT;
    v_job_title TEXT;
BEGIN
    -- Only run on insert or when status changes
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Find if a conversation exists for this application
        SELECT id INTO v_conv_id FROM public.conversations 
        WHERE application_id = NEW.id 
        LIMIT 1;

        -- If no conversation exists and status has updated to Interview or Hired, create one automatically
        IF v_conv_id IS NULL AND NEW.status IN ('Interview', 'Hired') THEN
            INSERT INTO public.conversations (employer_id, job_id, application_id, type)
            VALUES (NEW.employer_id, NEW.job_id, NEW.id, 'application')
            RETURNING id INTO v_conv_id;

            -- Add candidate participant
            INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role)
            VALUES (v_conv_id, NEW.candidate_id, 'candidate')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;

            -- Add all employer members as participants
            INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role)
            SELECT v_conv_id, user_id, 'employer'
            FROM public.employer_members
            WHERE employer_id = NEW.employer_id
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END IF;

        IF v_conv_id IS NOT NULL THEN
            -- Get job title
            SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id LIMIT 1;
            
            -- Map status to system messages in Slovak (primary portal language)
            v_system_msg := CASE NEW.status
                WHEN 'Pending' THEN 'Prihláška bola úspešne odoslaná.'
                WHEN 'Viewed' THEN 'Zamestnávateľ si pozrel váš profil.'
                WHEN 'Interview' THEN 'Zamestnávateľ vás pozval na pohovor. Vyberte si termín.'
                WHEN 'Interview-Confirmed' THEN 'Pohovor bol potvrdený na termín: ' || COALESCE(to_char(NEW.selected_date AT TIME ZONE 'Europe/Bratislava', 'DD.MM.YYYY HH24:MI'), '')
                WHEN 'Counter-Offer' THEN 'Kandidát navrhol iný termín pohovoru: ' || COALESCE(to_char(NEW.selected_date AT TIME ZONE 'Europe/Bratislava', 'DD.MM.YYYY HH24:MI'), '')
                WHEN 'Hired' THEN 'Gratulujeme! Boli ste prijatý na pozíciu ' || COALESCE(v_job_title, '') || '.'
                WHEN 'Rejected' THEN 'Výberové konanie bolo ukončené.'
                WHEN 'Declined' THEN 'Pozvanie na pohovor bolo odmietnuté.'
                ELSE 'Stav prihlášky sa zmenil na: ' || NEW.status
            END;

            -- Insert system message (sender_id IS NULL)
            INSERT INTO public.messages (conversation_id, sender_id, message_type, body)
            VALUES (v_conv_id, NULL, 'system', v_system_msg);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_status_changed
    AFTER INSERT OR UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_application_status_message();

-- =========================================================================
-- 7. ENABLE REALTIME SYNC
-- =========================================================================
-- Enable realtime on tables so frontend gets updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 22_trigger_application_messages.sql
-- Updates the handle_application_status_message trigger function to insert system messages into both the old messages table and the new application_messages table if they exist.

CREATE OR REPLACE FUNCTION public.handle_application_status_message()
RETURNS TRIGGER AS $$
DECLARE
    v_conv_id UUID;
    v_system_msg TEXT;
    v_job_title TEXT;
    v_has_messages_table BOOLEAN;
    v_has_app_messages_table BOOLEAN;
BEGIN
    -- Check table existence
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') INTO v_has_messages_table;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_messages') INTO v_has_app_messages_table;

    -- Only run on insert or when status/dates change
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.selected_date IS DISTINCT FROM NEW.selected_date)) THEN
        
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

        -- 1. Old virtualized conversation handling (only if public.messages and public.conversations exist)
        IF v_has_messages_table THEN
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
                INSERT INTO public.messages (conversation_id, sender_id, message_type, body)
                VALUES (v_conv_id, NULL, 'system', v_system_msg);
            END IF;
        END IF;

        -- 2. New dedicated application_messages handling (if it exists)
        IF v_has_app_messages_table THEN
            INSERT INTO public.application_messages (application_id, sender_id, message_type, body)
            VALUES (NEW.id, NULL, 'system', v_system_msg);
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

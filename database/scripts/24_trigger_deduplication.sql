-- 24_trigger_deduplication.sql
-- Upgrades public.handle_application_status_message trigger function to:
-- 1. Insert into public.notifications with a check to prevent duplicates.
-- 2. Insert into public.application_messages with a check to prevent duplicates.
-- 3. Maintain compatibility with the legacy public.messages and public.conversations.

CREATE OR REPLACE FUNCTION public.handle_application_status_message()
RETURNS TRIGGER AS $$
DECLARE
    v_conv_id UUID;
    v_system_msg TEXT;
    v_job_title TEXT;
    v_notif_type TEXT;
    v_notif_title TEXT;
    v_has_messages_table BOOLEAN;
    v_has_app_messages_table BOOLEAN;
    v_has_notifications_table BOOLEAN;
BEGIN
    -- Check table existence
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') INTO v_has_messages_table;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_messages') INTO v_has_app_messages_table;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') INTO v_has_notifications_table;

    -- Only run on insert or when status/dates change
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.selected_date IS DISTINCT FROM NEW.selected_date OR OLD.interview_dates IS DISTINCT FROM NEW.interview_dates)) THEN
        
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

        -- Map status to notification type and title
        v_notif_type := CASE NEW.status
            WHEN 'Interview' THEN 'interview_scheduled'
            WHEN 'Interview-Confirmed' THEN 'interview_confirmed'
            WHEN 'Counter-Offer' THEN 'counter_offer'
            WHEN 'Hired' THEN 'hired'
            WHEN 'Rejected' THEN 'rejected'
            WHEN 'Declined' THEN 'declined'
            ELSE 'general'
        END;

        v_notif_title := CASE NEW.status
            WHEN 'Interview' THEN 'Pozvánka na pohovor'
            WHEN 'Interview-Confirmed' THEN 'Pohovor potvrdený'
            WHEN 'Counter-Offer' THEN 'Protinávrh termínu'
            WHEN 'Hired' THEN 'Gratulujeme! 🎉'
            WHEN 'Rejected' THEN 'Odpoveď na prihlášku'
            WHEN 'Declined' THEN 'Pohovor odmietnutý'
            ELSE 'Aktualizácia prihlášky'
        END;

        -- 1. Insert into public.notifications with deduplication
        IF v_has_notifications_table THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications 
                WHERE related_entity_id = NEW.id 
                  AND type = v_notif_type 
                  AND message = v_system_msg
            ) THEN
                INSERT INTO public.notifications (user_id, type, title, message, related_entity_id, read)
                VALUES (NEW.candidate_id, v_notif_type, v_notif_title, v_system_msg, NEW.id, FALSE);
            END IF;
        END IF;

        -- 2. Old virtualized conversation handling (only if public.messages and public.conversations exist)
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
                IF NOT EXISTS (
                    SELECT 1 FROM public.messages 
                    WHERE conversation_id = v_conv_id 
                      AND body = v_system_msg
                ) THEN
                    INSERT INTO public.messages (conversation_id, sender_id, message_type, body)
                    VALUES (v_conv_id, NULL, 'system', v_system_msg);
                END IF;
            END IF;
        END IF;

        -- 3. New dedicated application_messages handling with deduplication
        IF v_has_app_messages_table THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.application_messages 
                WHERE application_id = NEW.id 
                  AND body = v_system_msg
            ) THEN
                INSERT INTO public.application_messages (application_id, sender_id, message_type, body)
                VALUES (NEW.id, NULL, 'system', v_system_msg);
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

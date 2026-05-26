-- 20_dedicated_messages_table.sql
-- Run this in your Supabase SQL Editor to create the dedicated messages table and enable realtime.

-- =========================================================================
-- 1. CREATE TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL represents system/notification message
    body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'interview_invite', 'status_change')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- =========================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_application_messages_application_id ON public.application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_created_at ON public.application_messages(created_at ASC);

-- =========================================================================
-- 3. ENABLE REALTIME
-- =========================================================================
-- Add the table to the supabase_realtime publication
alter publication supabase_realtime add table public.application_messages;

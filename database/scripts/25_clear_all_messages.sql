-- 25_clear_all_messages.sql
-- Clears ALL chat/message history from both employee and employer side.
-- This deletes from:
--   1. application_messages (dedicated messaging table)
--   2. messages (legacy messaging table, if it exists)
--   3. notifications related to chat messages (type = 'general')
--
-- WARNING: This is irreversible. Back up your data before running.

-- 1. Clear the dedicated application_messages table
DELETE FROM public.application_messages;

-- 2. Clear the legacy messages table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    EXECUTE 'DELETE FROM public.messages';
  END IF;
END $$;

-- 3. Clear chat-related notifications (type = 'general' are the chat messages sent via notifications)
DELETE FROM public.notifications WHERE type = 'general';

-- Done. All text message history has been cleared on both sides.

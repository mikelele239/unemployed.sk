-- 13_notifications_realtime.sql
-- Enable Supabase Realtime on the notifications table
-- so that new/updated notifications are pushed to clients instantly.
-- Run this in Supabase Dashboard > SQL Editor.

-- Add notifications to the Realtime publication
-- (This enables postgres_changes events for INSERT/UPDATE/DELETE)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Ensure the RLS SELECT policy exists (required for Realtime filtering)
-- Already created in 12_notifications.sql, but included here for safety:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Users read own notifications'
  ) THEN
    CREATE POLICY "Users read own notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

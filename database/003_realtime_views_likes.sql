-- ============================================================
-- unemployed.sk — Live Data Sync: Views, Likes & Realtime
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. Add counter columns to jobs table ───────────────────────────────────
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_views  int4 DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_likes  int4 DEFAULT 0;

-- ─── 2. Job Views tracking table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_views (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  viewer_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at   timestamptz DEFAULT now()
);

ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert a view
CREATE POLICY "Users can insert views"
  ON public.job_views FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Employers can read views for their own jobs
CREATE POLICY "Employers can read views"
  ON public.job_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_views.job_id
        AND jobs.employer_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_job_views_job_id ON public.job_views(job_id);

-- ─── 3. Job Likes tracking table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(job_id, user_id)
);

ALTER TABLE public.job_likes ENABLE ROW LEVEL SECURITY;

-- Users can manage their own likes
CREATE POLICY "Users can insert own likes"
  ON public.job_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON public.job_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own likes"
  ON public.job_likes FOR SELECT
  USING (auth.uid() = user_id);

-- Employers can see likes on their jobs
CREATE POLICY "Employers can read likes on own jobs"
  ON public.job_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_likes.job_id
        AND jobs.employer_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_job_likes_job_id ON public.job_likes(job_id);
CREATE INDEX IF NOT EXISTS idx_job_likes_user_id ON public.job_likes(user_id);

-- ─── 4. Postgres Trigger: Auto-increment total_views ────────────────────────
CREATE OR REPLACE FUNCTION public.increment_job_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.jobs
    SET total_views = total_views + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_job_views ON public.job_views;
CREATE TRIGGER trg_increment_job_views
  AFTER INSERT ON public.job_views
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_job_views();

-- ─── 5. Postgres Trigger: Auto-increment total_likes on INSERT ──────────────
CREATE OR REPLACE FUNCTION public.increment_job_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.jobs
    SET total_likes = total_likes + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_job_likes ON public.job_likes;
CREATE TRIGGER trg_increment_job_likes
  AFTER INSERT ON public.job_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_job_likes();

-- ─── 6. Postgres Trigger: Auto-decrement total_likes on DELETE (un-like) ────
CREATE OR REPLACE FUNCTION public.decrement_job_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.jobs
    SET total_likes = GREATEST(total_likes - 1, 0)
  WHERE id = OLD.job_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_decrement_job_likes ON public.job_likes;
CREATE TRIGGER trg_decrement_job_likes
  AFTER DELETE ON public.job_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_job_likes();

-- ─── 7. Backfill existing view counts from the `views` column ───────────────
-- (If you already had a `views` integer on jobs, copy it over)
UPDATE public.jobs SET total_views = COALESCE(views, 0) WHERE total_views = 0 AND views IS NOT NULL AND views > 0;

-- ─── 8. Enable Supabase Realtime on the jobs table ──────────────────────────
-- This enables postgres_changes events for INSERT/UPDATE/DELETE on jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- ─── 9. Also enable Realtime for job_views and job_likes (optional) ─────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_likes;

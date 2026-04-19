-- Run this in your Supabase SQL Editor to add coordinate support to your jobs table.

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS lat FLOAT8,
ADD COLUMN IF NOT EXISTS lng FLOAT8;

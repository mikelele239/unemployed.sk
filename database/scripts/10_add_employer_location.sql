-- 10_add_employer_location.sql
-- Adds a location column to the employers table for company headquarters/address display.
-- Run this in Supabase SQL Editor.

ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS location TEXT;

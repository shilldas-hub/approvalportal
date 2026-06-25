-- ============================================================
-- Fix Infinite Recursion in Profiles RLS
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Drop the old recursive policies
DROP POLICY IF EXISTS "profiles: own read" ON public.profiles;
DROP POLICY IF EXISTS "profiles: approver read all" ON public.profiles;

-- Create a new non-recursive policy
-- This allows any authenticated user to read all profiles.
-- Since profiles only contain id, full_name, and role, this is safe and
-- necessary so that Approvers can see Requester names, and Requesters 
-- can see their own profiles without triggering a recursive loop.
CREATE POLICY "profiles: read all authenticated"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

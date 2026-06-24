-- ============================================================
-- Greenlight — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- One row per user, created at signup
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('requester', 'approver')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Approvers can read all profiles (to show requester names)
CREATE POLICY "profiles: approver read all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

-- Users can insert their own profile (on signup)
CREATE POLICY "profiles: own insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- REQUESTS
-- Time-off requests submitted by requesters
-- ============================================================
CREATE TABLE public.requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('Vacation', 'Sick Leave', 'Personal', 'WFH')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Requesters can read their own requests
CREATE POLICY "requests: requester read own"
  ON public.requests FOR SELECT
  USING (auth.uid() = requester_id);

-- Requesters can insert their own requests
CREATE POLICY "requests: requester insert"
  ON public.requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Approvers can read all requests
CREATE POLICY "requests: approver read all"
  ON public.requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

-- Approvers can update status + decided_at
CREATE POLICY "requests: approver update status"
  ON public.requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

-- ============================================================
-- DECISIONS
-- Created by approver when acting on a request
-- ============================================================
CREATE TABLE public.decisions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  approver_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

-- Requesters can read decisions on their own requests
CREATE POLICY "decisions: requester read own"
  ON public.decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
  );

-- Approvers can read and insert all decisions
CREATE POLICY "decisions: approver read all"
  ON public.decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

CREATE POLICY "decisions: approver insert"
  ON public.decisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

-- ============================================================
-- Enable realtime for live UI updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decisions;

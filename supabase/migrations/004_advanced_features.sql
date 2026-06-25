-- ============================================================
-- Advanced Features: Priority, Storage, Routing, Comments
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add advanced columns to requests
ALTER TABLE public.requests ADD COLUMN priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'));
ALTER TABLE public.requests ADD COLUMN attachment_url TEXT;
ALTER TABLE public.requests ADD COLUMN assigned_to UUID REFERENCES public.profiles(id);

-- 2. Create Comments table for threaded discussions
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Requesters can see comments on their own requests
CREATE POLICY "comments: requester read own"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
  );

-- Requesters can insert comments on their own requests
CREATE POLICY "comments: requester insert"
  ON public.comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
    AND profile_id = auth.uid()
  );

-- Approvers can read all comments
CREATE POLICY "comments: approver read all"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
  );

-- Approvers can insert comments on any request
CREATE POLICY "comments: approver insert"
  ON public.comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'approver'
    )
    AND profile_id = auth.uid()
  );

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- 3. Storage bucket setup (Optional automated SQL for Storage, if enabled via Supabase)
-- Note: It is safer to create the bucket manually in the Supabase Dashboard -> Storage UI.
-- Name: 'attachments'
-- Public: yes (or no, but public is easier for downloading without signed URLs).

-- If manually created as public, we need a policy so authenticated users can insert:
-- CREATE POLICY "allow auth users to upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'attachments' );

# Nebula Approval Portal - Development Documentation

This document chronicles the step-by-step development and transformation of the Nebula Approval Portal from a simple "Time-Off Request" tracker into a comprehensive, multi-category, advanced approval system.

---

## Phase 1: Authentication & RLS Debugging
**Goal**: Resolve the infinite loading and authentication loop preventing the requester dashboard from loading.

**The Problem**:
When a user logged in, the application checked their role using a Supabase query on the `profiles` table. However, the `profiles` table had an active Row-Level Security (RLS) policy that itself performed a `SELECT` on the `profiles` table to verify if the user was an "approver". This created an infinite recursion loop in PostgreSQL, causing the proxy and frontend to hang and ultimately fail.

**The Solution**:
Created migration `002_fix_rls_recursion.sql` to drop the recursive policies and replace them with a single, highly performant policy allowing all authenticated users to read profiles:
```sql
CREATE OR REPLACE POLICY "profiles: read all authenticated"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

---

## Phase 2: Portal Generalization
**Goal**: Expand the portal from exclusively handling "Time Off" to supporting **Time Off, Budget, Equipment, and Access** requests.

**The Problem**:
The `requests` table had strict check constraints (`requests_type_check` and `valid_date_range`) that forced every request to be a "leave type" and required start/end dates.

**The Solution**:
1. **Migration (`003_generalize_requests.sql`)**:
   - Added a `category` column (`Time Off`, `Budget`, `Equipment`, `Access`).
   - Added a generic JSONB `details` column to store varying attributes (e.g., `amount`, `purpose`, `item_name`).
   - Dropped the `valid_date_range` constraint.
   - Dropped the `requests_type_check` constraint to allow dynamic types.
2. **Frontend UI**:
   - Refactored `RequesterClient.tsx` to include dynamic form fields that conditionally render based on the selected Category.
   - Refactored `ApproverClient.tsx` to neatly format and summarize these different JSONB payloads natively in the UI.
3. **Manager Organization**:
   - Updated the manager dashboard to group pending and decided requests into specific visual folders based on their category.

---

## Phase 3: Advanced Features Implementation
**Goal**: Implement enterprise-grade features including Priority/Urgency levels, Comment Threads, File Attachments, Dynamic Routing, and Telegram Notifications.

**The Solution**:
1. **Migration (`004_advanced_features.sql`)**:
   - Added `priority`, `attachment_url`, and `assigned_to` columns to `requests`.
   - Created a new `comments` table with cascading deletes and specific RLS policies allowing requesters and approvers to converse.
   - Added RLS policies to `storage.objects` to allow authenticated file uploads to the `attachments` bucket.

2. **File Attachments (Supabase Storage)**:
   - Added file inputs to the submission form.
   - Integrated the Supabase JS client in `requests.ts` to upload the file to the `attachments` bucket, generate a public URL, and save it to the database row.

3. **Discussion Threads**:
   - Built `CommentThread` React components into the request cards.
   - Built a new server action `app/actions/comments.ts` to insert comments.
   - Updated real-time subscriptions in the clients to listen to the `comments` table so threads update instantly without refreshing.

4. **Dynamic Routing**:
   - Modified `createRequest` to fetch a designated manager (an approver) and assign the request explicitly via the `assigned_to` column.

5. **Telegram Notifications**:
   - Built `app/api/notify/route.ts` to interact with the official Telegram Bot API.
   - Integrated the `notify()` helper into all server actions (Create, Approve, Deny, Comment) to dispatch rich markdown alerts if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are present in `.env.local`.

---

## Phase 4: Bug Fixes & Refinement
**Goal**: Resolve unexpected issues stemming from the advanced features.

**1. Supabase Join Ambiguity**
* **The Problem**: After adding the `assigned_to` column (which references `profiles`), the manager's dashboard stopped loading requests and showed "All caught up". This occurred because the `requests` table now had TWO foreign keys to `profiles` (`requester_id` and `assigned_to`). When the frontend queried `profiles ( full_name )`, Supabase PostgREST threw an ambiguity error.
* **The Solution**: Updated all `page.tsx` and Client components to explicitly specify the foreign key path: `profiles!requests_requester_id_fkey ( full_name )`.

**2. Vercel Build Failure**
* **The Problem**: Vercel failed to compile the project because a temporary debug script (`test_query.ts`) imported `dotenv`, which was not in the dependencies list.
* **The Solution**: Deleted `test_query.ts` from the repository, clearing the way for a successful Vercel production build.

---

## Final Setup Checklist for Production
To run this application cleanly in a new environment, ensure the following steps are taken:
1. Run `npm install`.
2. Connect to Supabase and run all SQL files in `supabase/migrations/` sequentially.
3. Manually create the `attachments` bucket in the Supabase Storage UI and set it to Public.
4. Provide the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

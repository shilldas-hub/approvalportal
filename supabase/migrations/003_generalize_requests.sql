-- ============================================================
-- Generalize requests to support Time Off, Budget, Equipment, Access
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add category and details columns
ALTER TABLE public.requests ADD COLUMN category TEXT;
ALTER TABLE public.requests ADD COLUMN details JSONB DEFAULT '{}'::jsonb;

-- 2. Backfill category based on existing data
UPDATE public.requests SET category = 'Time Off' WHERE category IS NULL;

-- 3. Make the category column NOT NULL now that it's backfilled
ALTER TABLE public.requests ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.requests ADD CONSTRAINT valid_category CHECK (category IN ('Time Off', 'Budget', 'Equipment', 'Access'));

-- 4. Make start_date and end_date nullable, as other categories don't need them
ALTER TABLE public.requests ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.requests ALTER COLUMN end_date DROP NOT NULL;

-- 5. Drop the valid_date_range constraint (we will handle it in app logic, or redefine it conditionally)
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS valid_date_range;

-- 6. Drop the type check constraint since type is now freeform (varies by category)
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_type_check;

-- ============================================================================
-- Supabase Cache Migration
-- Add support for multiple Google Sheets caches (tasks + staging)
-- ============================================================================

-- 1. Insert cache rows for tasks and staging sheets
-- ============================================================================

INSERT INTO sheets_cache (
  id,
  tasks_data,
  last_updated,
  updated_by,
  consecutive_errors,
  total_errors,
  total_fetches,
  is_updating,
  update_lock_client,
  update_started_at,
  last_error,
  last_error_at
)
VALUES (
  'tasks',
  '[]'::jsonb,
  '1970-01-01T00:00:00.000Z'::timestamptz,
  'system',
  0,
  0,
  0,
  false,
  null,
  null,
  null,
  null
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sheets_cache (
  id,
  tasks_data,
  last_updated,
  updated_by,
  consecutive_errors,
  total_errors,
  total_fetches,
  is_updating,
  update_lock_client,
  update_started_at,
  last_error,
  last_error_at
)
VALUES (
  'staging',
  '[]'::jsonb,
  '1970-01-01T00:00:00.000Z'::timestamptz,
  'system',
  0,
  0,
  0,
  false,
  null,
  null,
  null,
  null
)
ON CONFLICT (id) DO NOTHING;


-- 2. Update acquire_cache_update_lock function to support cache_identifier
-- ============================================================================

DROP FUNCTION IF EXISTS acquire_cache_update_lock(TEXT);

CREATE OR REPLACE FUNCTION acquire_cache_update_lock(
  client_identifier TEXT,
  cache_identifier TEXT DEFAULT 'primary'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lock_held BOOLEAN;
  lock_expired BOOLEAN;
  current_time TIMESTAMPTZ := NOW();
  lock_timeout_seconds INTEGER := 120; -- 2 minutes
BEGIN
  -- Check if lock exists and is still valid for this cache
  SELECT
    (update_lock_client IS NOT NULL) AS is_held,
    (update_started_at IS NULL OR
     update_started_at < current_time - (lock_timeout_seconds || ' seconds')::INTERVAL) AS is_expired
  INTO lock_held, lock_expired
  FROM sheets_cache
  WHERE id = cache_identifier;

  -- If no row found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If no lock or lock expired, acquire it
  IF NOT lock_held OR lock_expired THEN
    UPDATE sheets_cache
    SET
      update_lock_client = client_identifier,
      update_started_at = current_time,
      is_updating = TRUE
    WHERE id = cache_identifier;

    RETURN TRUE;
  END IF;

  -- Lock is held by another client
  RETURN FALSE;
END;
$$;


-- 3. Update release_cache_update_lock function to support cache_identifier
-- ============================================================================

DROP FUNCTION IF EXISTS release_cache_update_lock();

CREATE OR REPLACE FUNCTION release_cache_update_lock(
  cache_identifier TEXT DEFAULT 'primary'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sheets_cache
  SET
    update_lock_client = NULL,
    update_started_at = NULL,
    is_updating = FALSE
  WHERE id = cache_identifier;
END;
$$;


-- 4. Verify the migration
-- ============================================================================

-- Check that all cache rows exist
SELECT id, last_updated, total_fetches
FROM sheets_cache
WHERE id IN ('primary', 'tasks', 'staging')
ORDER BY id;

-- Verify functions exist with correct signatures
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name IN ('acquire_cache_update_lock', 'release_cache_update_lock')
  AND routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- You should now see:
-- - 3 rows in sheets_cache (primary, tasks, staging)
-- - 2 functions with updated signatures
-- ============================================================================

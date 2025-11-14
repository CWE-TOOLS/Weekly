-- ============================================================================
-- Fix Supabase Cache Functions (v2)
-- Fixes the interval type casting using make_interval()
-- ============================================================================

-- 1. Drop existing functions completely
-- ============================================================================
DROP FUNCTION IF EXISTS acquire_cache_update_lock(TEXT);
DROP FUNCTION IF EXISTS acquire_cache_update_lock(TEXT, TEXT);
DROP FUNCTION IF EXISTS release_cache_update_lock();
DROP FUNCTION IF EXISTS release_cache_update_lock(TEXT);


-- 2. Create acquire_cache_update_lock with PROPER interval handling
-- ============================================================================
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
     (update_started_at + make_interval(secs => lock_timeout_seconds)) < current_time) AS is_expired
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


-- 3. Create release_cache_update_lock
-- ============================================================================
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


-- 4. Verify functions were created
-- ============================================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('acquire_cache_update_lock', 'release_cache_update_lock')
  AND n.nspname = 'public'
ORDER BY p.proname;


-- 5. Test the functions
-- ============================================================================
-- Test acquiring lock for 'tasks' cache
SELECT acquire_cache_update_lock('test-client-final', 'tasks') as lock_acquired;

-- Should return TRUE

-- Check lock was set
SELECT id, update_lock_client, is_updating, update_started_at
FROM sheets_cache
WHERE id = 'tasks';

-- Release the test lock
SELECT release_cache_update_lock('tasks') as released;

-- Check lock was released
SELECT id, update_lock_client, is_updating
FROM sheets_cache
WHERE id = 'tasks';


-- ============================================================================
-- Fix Complete
-- ============================================================================
-- The functions should now work without type casting errors
-- Refresh your browser and check the console logs
-- ============================================================================

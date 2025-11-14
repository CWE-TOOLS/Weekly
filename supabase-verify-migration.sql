-- ============================================================================
-- Verify Supabase Cache Migration
-- Run this to check if everything was updated correctly
-- ============================================================================

-- 1. Check cache rows exist
-- ============================================================================
SELECT
  id,
  last_updated,
  total_fetches,
  is_updating,
  update_lock_client,
  CASE
    WHEN last_updated > NOW() - INTERVAL '5 minutes' THEN 'FRESH'
    WHEN last_updated > NOW() - INTERVAL '30 minutes' THEN 'STALE'
    ELSE 'VERY STALE'
  END as cache_status
FROM sheets_cache
WHERE id IN ('primary', 'tasks', 'staging')
ORDER BY id;

-- Expected: Should see 3 rows (primary, tasks, staging)


-- 2. Check acquire_cache_update_lock function signature
-- ============================================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'acquire_cache_update_lock'
  AND n.nspname = 'public';

-- Expected: arguments should be "client_identifier text, cache_identifier text DEFAULT 'primary'::text"


-- 3. Check release_cache_update_lock function signature
-- ============================================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'release_cache_update_lock'
  AND n.nspname = 'public';

-- Expected: arguments should be "cache_identifier text DEFAULT 'primary'::text"


-- 4. Test the acquire lock function (optional - will acquire and release a test lock)
-- ============================================================================
-- Test acquiring lock for 'tasks' cache
SELECT acquire_cache_update_lock('test-client-123', 'tasks') as lock_acquired;

-- Expected: Should return TRUE

-- Check the lock was set
SELECT id, update_lock_client, is_updating
FROM sheets_cache
WHERE id = 'tasks';

-- Expected: update_lock_client should be 'test-client-123', is_updating should be TRUE

-- Release the test lock
SELECT release_cache_update_lock('tasks');

-- Check the lock was released
SELECT id, update_lock_client, is_updating
FROM sheets_cache
WHERE id = 'tasks';

-- Expected: update_lock_client should be NULL, is_updating should be FALSE


-- ============================================================================
-- Summary of Expected Results:
-- ============================================================================
-- 1. Three cache rows: primary, tasks, staging
-- 2. acquire_cache_update_lock has 2 parameters (client_identifier, cache_identifier)
-- 3. release_cache_update_lock has 1 parameter (cache_identifier)
-- 4. Test lock/unlock works correctly
-- ============================================================================

-- =====================================================
-- Google Sheets Cache Table Setup
-- =====================================================
-- This table caches Google Sheets data to reduce API calls
-- and eliminate throttling issues. Uses leader election
-- to ensure only one client fetches from Google Sheets.
-- =====================================================

-- Drop existing table if migrating
DROP TABLE IF EXISTS sheets_cache;

-- Main cache table (single-row cache for all Google Sheets tasks)
CREATE TABLE sheets_cache (
    id TEXT PRIMARY KEY DEFAULT 'primary',

    -- Cached data from Google Sheets
    tasks_data JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Cache metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,                          -- Client identifier (optional)
    version INTEGER NOT NULL DEFAULT 1,       -- Optimistic locking version

    -- Lock mechanism for coordinated updates
    is_updating BOOLEAN NOT NULL DEFAULT false,
    update_started_at TIMESTAMPTZ,            -- When update lock was acquired
    update_lock_client TEXT,                  -- Which client holds the lock

    -- Error tracking
    last_error TEXT,                          -- Last fetch error (if any)
    last_error_at TIMESTAMPTZ,                -- When error occurred
    consecutive_errors INTEGER DEFAULT 0,      -- Count of consecutive failures

    -- Stats
    total_fetches INTEGER DEFAULT 0,          -- Total successful fetches
    total_errors INTEGER DEFAULT 0,           -- Total fetch errors

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial cache row
INSERT INTO sheets_cache (id, tasks_data, last_updated)
VALUES ('primary', '[]'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- Index for faster version checks (optimistic locking)
CREATE INDEX idx_sheets_cache_version ON sheets_cache(version);

-- Index for monitoring stale locks
CREATE INDEX idx_sheets_cache_updating ON sheets_cache(is_updating, update_started_at);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE sheets_cache ENABLE ROW LEVEL SECURITY;

-- Allow all read operations (cache is public data)
CREATE POLICY "Allow read access to sheets_cache"
    ON sheets_cache
    FOR SELECT
    USING (true);

-- Allow all update operations (any client can update cache)
CREATE POLICY "Allow update access to sheets_cache"
    ON sheets_cache
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow all insert operations (for initial setup)
CREATE POLICY "Allow insert access to sheets_cache"
    ON sheets_cache
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions to anonymous and authenticated users
GRANT SELECT, UPDATE, INSERT ON sheets_cache TO anon;
GRANT SELECT, UPDATE, INSERT ON sheets_cache TO authenticated;

-- =====================================================
-- Helper Function: Clean Stale Locks
-- =====================================================
-- This function releases locks that have been held for too long
-- (default: 2 minutes). Should be called before attempting to
-- acquire a lock.
-- =====================================================

CREATE OR REPLACE FUNCTION clean_stale_cache_locks(
    stale_timeout_seconds INTEGER DEFAULT 120
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE sheets_cache
    SET
        is_updating = false,
        update_lock_client = NULL,
        update_started_at = NULL
    WHERE
        id = 'primary'
        AND is_updating = true
        AND update_started_at < (NOW() - INTERVAL '1 second' * stale_timeout_seconds);

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RETURN updated_count;
END;
$$;

-- =====================================================
-- Helper Function: Acquire Cache Update Lock
-- =====================================================
-- Atomically attempts to acquire the update lock.
-- Returns TRUE if lock was acquired, FALSE otherwise.
-- Uses optimistic locking to prevent race conditions.
-- =====================================================

CREATE OR REPLACE FUNCTION acquire_cache_update_lock(
    client_identifier TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    lock_acquired BOOLEAN := false;
    current_version INTEGER;
BEGIN
    -- First, clean any stale locks
    PERFORM clean_stale_cache_locks();

    -- Get current version
    SELECT version INTO current_version
    FROM sheets_cache
    WHERE id = 'primary';

    -- Attempt to acquire lock (atomic operation)
    UPDATE sheets_cache
    SET
        is_updating = true,
        update_started_at = NOW(),
        update_lock_client = client_identifier,
        version = version + 1
    WHERE
        id = 'primary'
        AND is_updating = false
        AND version = current_version;

    -- Check if we successfully acquired the lock
    GET DIAGNOSTICS lock_acquired = FOUND;

    RETURN lock_acquired;
END;
$$;

-- =====================================================
-- Helper Function: Release Cache Update Lock
-- =====================================================
-- Releases the update lock after cache update completes.
-- =====================================================

CREATE OR REPLACE FUNCTION release_cache_update_lock()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sheets_cache
    SET
        is_updating = false,
        update_lock_client = NULL,
        update_started_at = NULL
    WHERE id = 'primary';
END;
$$;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE sheets_cache IS 'Caches Google Sheets data to reduce API calls and eliminate throttling';
COMMENT ON COLUMN sheets_cache.tasks_data IS 'Array of task objects from Google Sheets (JSONB)';
COMMENT ON COLUMN sheets_cache.is_updating IS 'Lock flag to prevent concurrent Google Sheets fetches';
COMMENT ON COLUMN sheets_cache.version IS 'Optimistic locking version number';
COMMENT ON COLUMN sheets_cache.update_started_at IS 'Timestamp when update lock was acquired (for detecting stale locks)';

-- =====================================================
-- Indexes for monitoring and debugging
-- =====================================================

-- Create view for monitoring cache status
CREATE OR REPLACE VIEW sheets_cache_status AS
SELECT
    id,
    last_updated,
    NOW() - last_updated AS age,
    is_updating,
    update_started_at,
    CASE
        WHEN update_started_at IS NOT NULL
        THEN NOW() - update_started_at
        ELSE NULL
    END AS lock_duration,
    update_lock_client,
    jsonb_array_length(tasks_data) AS cached_tasks_count,
    last_error,
    last_error_at,
    consecutive_errors,
    total_fetches,
    total_errors,
    CASE
        WHEN total_fetches > 0
        THEN ROUND((total_errors::NUMERIC / total_fetches::NUMERIC) * 100, 2)
        ELSE 0
    END AS error_rate_percent,
    version
FROM sheets_cache;

GRANT SELECT ON sheets_cache_status TO anon;
GRANT SELECT ON sheets_cache_status TO authenticated;

-- =====================================================
-- Complete!
-- =====================================================
-- Run this script in your Supabase SQL editor to set up
-- the Google Sheets caching infrastructure.
-- =====================================================

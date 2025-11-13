/**
 * Google Sheets Cache Service
 *
 * Manages cached Google Sheets data in Supabase to reduce API calls
 * and eliminate throttling issues. Uses leader election to ensure
 * only one client fetches from Google Sheets API at a time.
 *
 * @module services/sheets-cache-service
 */

import { getSupabaseClient, initializeSupabase } from './supabase-service.js';
import { fetchTasks } from './sheets-service.js';
import { logger } from '../utils/logger.js';

// Configuration
const CACHE_CONFIG = {
    CACHE_TTL_MS: 5 * 60 * 1000,           // 5 minutes default cache lifetime
    MAX_STALE_MS: 30 * 60 * 1000,          // 30 minutes max stale before forcing refresh
    LOCK_TIMEOUT_MS: 120 * 1000,           // 2 minutes lock timeout (matches SQL function)
    UPDATE_RETRY_DELAY_MS: 2000,           // Wait 2s before retrying if lock is held
    MAX_UPDATE_RETRIES: 3,                 // Max retries if cache update fails
    ENABLE_CACHE: true,                    // Master switch to enable/disable caching
    BROADCAST_CHANNEL: 'sheets_cache_updates' // Real-time broadcast channel name
};

// Client state
let cacheSubscription = null;
let clientId = generateClientId();

/**
 * Generate unique client identifier for debugging
 * @returns {string} Unique client ID
 */
function generateClientId() {
    return `client-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
}

/**
 * Get cache configuration (can be overridden)
 * @returns {Object} Current cache configuration
 */
export function getCacheConfig() {
    return { ...CACHE_CONFIG };
}

/**
 * Update cache configuration
 * @param {Object} updates - Configuration updates
 */
export function updateCacheConfig(updates) {
    Object.assign(CACHE_CONFIG, updates);
    logger.debug(`[Cache] Configuration updated:`, updates);
}

/**
 * Check if cache is fresh (within TTL)
 * @param {Object} cache - Cache object from database
 * @returns {boolean} True if cache is fresh
 */
function isCacheFresh(cache) {
    if (!cache || !cache.last_updated) return false;

    const cacheAge = Date.now() - new Date(cache.last_updated).getTime();
    const isFresh = cacheAge < CACHE_CONFIG.CACHE_TTL_MS;

    logger.debug(`[Cache] Cache age: ${(cacheAge / 1000).toFixed(0)}s, Fresh: ${isFresh}`);
    return isFresh;
}

/**
 * Check if cache is too stale to use
 * @param {Object} cache - Cache object from database
 * @returns {boolean} True if cache is too stale
 */
function isCacheTooStale(cache) {
    if (!cache || !cache.last_updated) return true;

    const cacheAge = Date.now() - new Date(cache.last_updated).getTime();
    return cacheAge > CACHE_CONFIG.MAX_STALE_MS;
}

/**
 * Get current cache from Supabase
 * @returns {Promise<Object|null>} Cache object or null if not found
 */
async function getCache() {
    const startTime = performance.now();

    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('sheets_cache')
            .select('*')
            .eq('id', 'primary')
            .single();

        const duration = (performance.now() - startTime).toFixed(0);

        if (error) {
            logger.error(`[Cache] Failed to get cache (${duration}ms):`, error);
            return null;
        }

        logger.debug(`[Cache] Retrieved cache in ${duration}ms`);
        return data;
    } catch (err) {
        logger.error('[Cache] Exception getting cache:', err);
        return null;
    }
}

/**
 * Attempt to acquire update lock using Supabase function
 * @returns {Promise<boolean>} True if lock acquired
 */
async function acquireUpdateLock() {
    const startTime = performance.now();

    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .rpc('acquire_cache_update_lock', { client_identifier: clientId });

        const duration = (performance.now() - startTime).toFixed(0);

        if (error) {
            logger.error(`[Cache] Failed to acquire lock (${duration}ms):`, error);
            return false;
        }

        const lockAcquired = data === true;
        if (lockAcquired) {
            logger.info(`[Cache] Lock acquired - this client is now the leader (${duration}ms)`);
        } else {
            logger.debug(`[Cache] Lock acquisition failed - another client is leader (${duration}ms)`);
        }

        return lockAcquired;
    } catch (err) {
        logger.error('[Cache] Exception acquiring lock:', err);
        return false;
    }
}

/**
 * Release update lock
 * @returns {Promise<void>}
 */
async function releaseUpdateLock() {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase
            .rpc('release_cache_update_lock');

        if (error) {
            logger.error('[Cache] Failed to release lock:', error);
        } else {
            logger.debug('[Cache] Lock released');
        }
    } catch (err) {
        logger.error('[Cache] Exception releasing lock:', err);
    }
}

/**
 * Update cache with fresh Google Sheets data
 * @param {Array} tasksData - Fresh tasks data from Google Sheets
 * @returns {Promise<boolean>} True if update successful
 */
async function updateCache(tasksData) {
    const startTime = performance.now();

    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        // First, get current stats
        const { data: currentCache } = await supabase
            .from('sheets_cache')
            .select('total_fetches')
            .eq('id', 'primary')
            .single();

        const { error } = await supabase
            .from('sheets_cache')
            .update({
                tasks_data: tasksData,
                last_updated: new Date().toISOString(),
                updated_by: clientId,
                last_error: null,
                last_error_at: null,
                consecutive_errors: 0,
                total_fetches: (currentCache?.total_fetches || 0) + 1
            })
            .eq('id', 'primary');

        const duration = (performance.now() - startTime).toFixed(0);

        if (error) {
            logger.error(`[Cache] Failed to update cache (${duration}ms):`, error);
            return false;
        }

        logger.debug(`[Cache] Cache updated in database in ${duration}ms (${tasksData.length} tasks)`);
        return true;
    } catch (err) {
        logger.error('[Cache] Exception updating cache:', err);
        return false;
    }
}

/**
 * Record cache update error
 * @param {Error} error - Error that occurred
 */
async function recordCacheError(error) {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        // First, get current error counts
        const { data: currentCache } = await supabase
            .from('sheets_cache')
            .select('consecutive_errors, total_errors')
            .eq('id', 'primary')
            .single();

        await supabase
            .from('sheets_cache')
            .update({
                last_error: error.message || String(error),
                last_error_at: new Date().toISOString(),
                consecutive_errors: (currentCache?.consecutive_errors || 0) + 1,
                total_errors: (currentCache?.total_errors || 0) + 1
            })
            .eq('id', 'primary');

        logger.debug('[Cache] Error recorded in cache stats');
    } catch (err) {
        logger.error('[Cache] Failed to record error:', err);
    }
}

/**
 * Broadcast cache update to all clients via real-time channel
 * @param {Object} info - Update information
 */
async function broadcastCacheUpdate(info = {}) {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const channel = supabase.channel(CACHE_CONFIG.BROADCAST_CHANNEL);

        await channel.send({
            type: 'broadcast',
            event: 'cache_updated',
            payload: {
                timestamp: new Date().toISOString(),
                client_id: clientId,
                tasks_count: info.tasksCount || 0,
                ...info
            }
        });

        logger.debug('[Cache] Broadcast sent to all clients');
    } catch (err) {
        logger.error('[Cache] Failed to broadcast update:', err);
    }
}

/**
 * Fetch fresh data from Google Sheets and update cache
 * This function assumes the update lock has already been acquired
 *
 * @returns {Promise<Array|null>} Fresh tasks data or null if failed
 */
async function fetchAndUpdateCache() {
    const startTime = performance.now();
    logger.info(`[Cache] 🔄 Fetching fresh data from Google Sheets API... (leader: ${clientId.substring(0, 12)}...)`);

    try {
        // Fetch from Google Sheets API
        const tasksData = await fetchTasks();

        if (!tasksData || !Array.isArray(tasksData)) {
            throw new Error('Invalid tasks data from Google Sheets');
        }

        // Update cache
        const updateSuccess = await updateCache(tasksData);

        if (!updateSuccess) {
            throw new Error('Failed to update cache in Supabase');
        }

        // Broadcast to all clients
        await broadcastCacheUpdate({ tasksCount: tasksData.length });

        const duration = (performance.now() - startTime).toFixed(0);
        logger.info(`[Cache] ✅ Fetched ${tasksData.length} tasks from Google Sheets API in ${duration}ms`);

        return tasksData;

    } catch (err) {
        const duration = (performance.now() - startTime).toFixed(0);
        logger.error(`[Cache] Cache refresh failed after ${duration}ms:`, err);

        await recordCacheError(err);
        return null;

    } finally {
        // Always release lock
        await releaseUpdateLock();
    }
}

/**
 * Wait for another client to finish updating cache
 * @param {number} timeoutMs - How long to wait (default: 30s)
 * @returns {Promise<Array|null>} Updated cache data or null if timeout
 */
async function waitForCacheUpdate(timeoutMs = 30000) {
    logger.debug(`[Cache] Waiting for another client to update cache...`);

    return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        // Set timeout
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                logger.warn('[Cache] ⚠️ Wait timeout - fetching cache anyway');
                getCache().then(cache => {
                    resolve(cache ? cache.tasks_data : null);
                });
            }
        }, timeoutMs);

        // Subscribe to cache updates
        const handleUpdate = async () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);

                const duration = (Date.now() - startTime).toFixed(0);
                logger.debug(`[Cache] Received cache update after ${duration}ms`);

                const cache = await getCache();
                resolve(cache ? cache.tasks_data : null);
            }
        };

        setupCacheSubscription(handleUpdate);
    });
}

/**
 * Setup real-time subscription for cache updates
 * @param {Function} onUpdate - Callback when cache is updated
 */
export async function setupCacheSubscription(onUpdate) {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        if (!supabase) {
            logger.warn('[Cache] Supabase client not available, skipping cache subscription');
            return;
        }

        // Remove existing subscription if any
        if (cacheSubscription) {
            cacheSubscription.unsubscribe();
        }

        cacheSubscription = supabase
            .channel(CACHE_CONFIG.BROADCAST_CHANNEL)
            .on('broadcast', { event: 'cache_updated' }, (payload) => {
                logger.debug('[Cache] Received cache update broadcast:', payload);
                if (onUpdate) {
                    onUpdate(payload);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    logger.info('[Cache] Subscribed to real-time cache updates');
                } else if (status === 'CLOSED') {
                    logger.debug('[Cache] Cache subscription closed');
                } else if (status === 'CHANNEL_ERROR') {
                    logger.error('[Cache] Cache subscription error');
                }
            });
    } catch (error) {
        logger.error('[Cache] Failed to setup cache subscription:', error);
    }
}

/**
 * Remove cache subscription
 */
export function removeCacheSubscription() {
    if (cacheSubscription) {
        cacheSubscription.unsubscribe();
        cacheSubscription = null;
        logger.debug('[Cache] Cache subscription removed');
    }
}

/**
 * Main function: Load Google Sheets data from cache or fetch fresh
 *
 * This is the primary entry point for getting Google Sheets data.
 * It implements a smart caching strategy with leader election:
 *
 * 1. Check if cache exists and is fresh → return cached data
 * 2. If stale, try to acquire update lock → fetch and update
 * 3. If lock is held by another client → wait for their update
 * 4. If cache is too stale → force fetch regardless of lock
 *
 * @param {boolean} forceRefresh - Force refresh from Google Sheets
 * @returns {Promise<Array>} Tasks data array
 */
export async function loadFromCacheOrFetch(forceRefresh = false) {
    const startTime = performance.now();
    logger.debug(`[Cache] loadFromCacheOrFetch() called (force: ${forceRefresh}, enabled: ${CACHE_CONFIG.ENABLE_CACHE})`);

    // If caching is disabled, always fetch directly
    if (!CACHE_CONFIG.ENABLE_CACHE) {
        logger.debug('[Cache] Caching disabled, fetching directly from Google Sheets');
        return await fetchTasks();
    }

    try {
        // Get current cache
        const cache = await getCache();

        // Check if cache is fresh and force refresh not requested
        if (!forceRefresh && cache && isCacheFresh(cache)) {
            const duration = (performance.now() - startTime).toFixed(0);
            const cacheAge = Math.round((Date.now() - new Date(cache.last_updated).getTime()) / 1000);
            logger.info(`[Cache] ✅ Cache hit - loaded ${cache.tasks_data.length} tasks in ${duration}ms (cache age: ${cacheAge}s)`);
            return cache.tasks_data;
        }

        // Cache is stale or doesn't exist - try to update
        logger.info('[Cache] ⚠️ Cache miss - cache is stale or missing, attempting refresh...');

        // Try to acquire update lock (with retries)
        let lockAcquired = false;
        for (let i = 0; i < CACHE_CONFIG.MAX_UPDATE_RETRIES; i++) {
            lockAcquired = await acquireUpdateLock();

            if (lockAcquired) {
                break;
            }

            // Lock not acquired - another client is updating
            if (i < CACHE_CONFIG.MAX_UPDATE_RETRIES - 1) {
                logger.debug(`[Cache] Lock held by another client, retrying in ${CACHE_CONFIG.UPDATE_RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.UPDATE_RETRY_DELAY_MS));
            }
        }

        if (lockAcquired) {
            // We got the lock - we're the leader, fetch and update
            const freshData = await fetchAndUpdateCache();

            if (freshData) {
                return freshData;
            }

            // Fetch failed - use stale cache if available
            if (cache && cache.tasks_data) {
                logger.warn('[Cache] ⚠️ Fetch failed, using stale cache');
                return cache.tasks_data;
            }

            // No cache available - must throw error
            throw new Error('Cache update failed and no stale cache available');
        } else {
            // Lock not acquired - another client is updating
            // Check if cache is too stale to wait
            if (isCacheTooStale(cache)) {
                logger.warn('[Cache] ⚠️ Cache too stale, fetching directly');
                return await fetchTasks();
            }

            // Wait for other client's update
            const updatedData = await waitForCacheUpdate();

            if (updatedData) {
                const duration = (performance.now() - startTime).toFixed(0);
                logger.debug(`[Cache] Received update from other client (${duration}ms)`);
                return updatedData;
            }

            // Wait timed out - use stale cache if available
            if (cache && cache.tasks_data) {
                logger.warn('[Cache] ⚠️ Wait timeout, using stale cache');
                return cache.tasks_data;
            }

            // Fallback to direct fetch
            logger.warn('[Cache] ⚠️ No cache available, fetching directly');
            return await fetchTasks();
        }

    } catch (err) {
        const duration = (performance.now() - startTime).toFixed(0);
        logger.error(`[Cache] ❌ loadFromCacheOrFetch failed after ${duration}ms:`, err);

        // Last resort - try direct fetch
        logger.warn('[Cache] Falling back to direct Google Sheets fetch');
        return await fetchTasks();
    }
}

/**
 * Force refresh cache from Google Sheets
 * @returns {Promise<Array>} Fresh tasks data
 */
export async function forceRefreshCache() {
    logger.debug('[Cache] Force refresh requested');
    return await loadFromCacheOrFetch(true);
}

/**
 * Get cache statistics for monitoring
 * @returns {Promise<Object|null>} Cache statistics
 */
export async function getCacheStats() {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('sheets_cache_status')
            .select('*')
            .eq('id', 'primary')
            .single();

        if (error) {
            logger.error('[Cache] Failed to get cache stats:', error);
            return null;
        }

        return data;
    } catch (err) {
        logger.error('[Cache] Exception getting cache stats:', err);
        return null;
    }
}

/**
 * Clear cache (for debugging/testing)
 * @returns {Promise<boolean>} True if successful
 */
export async function clearCache() {
    try {
        // Ensure Supabase is initialized
        if (!getSupabaseClient()) {
            await initializeSupabase();
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('sheets_cache')
            .update({
                tasks_data: [],
                last_updated: new Date(0).toISOString(), // Force stale
                is_updating: false,
                update_lock_client: null,
                update_started_at: null
            })
            .eq('id', 'primary');

        if (error) {
            logger.error('[Cache] Failed to clear cache:', error);
            return false;
        }

        logger.info('[Cache] ✅ Cache cleared');
        return true;
    } catch (err) {
        logger.error('[Cache] Exception clearing cache:', err);
        return false;
    }
}

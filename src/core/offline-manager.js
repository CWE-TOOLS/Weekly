/**
 * Offline Manager
 * Handles offline state and provides user feedback
 * Queues operations for when connection is restored
 * @module core/offline-manager
 */

import * as eventBus from './event-bus.js';
import { showWarningNotification, showInfoNotification } from './error-handler.js';

let isOffline = !navigator.onLine;
let offlineQueue = [];
let offlineIndicator = null;
let queueCountElement = null;

/**
 * Initialize offline manager
 * Sets up connection listeners and UI
 */
export function initializeOfflineManager() {
  console.log('📡 Initializing offline manager...');

  // Get UI elements
  offlineIndicator = document.getElementById('offline-indicator');
  queueCountElement = document.getElementById('offline-queue-count');

  // Update offline state
  updateOfflineState();

  // Listen to connection changes from global listeners
  eventBus.on(eventBus.EVENTS.CONNECTION_CHANGED, handleConnectionChange);

  // Also listen to native events as backup
  window.addEventListener('online', () => handleConnectionChange({ online: true }));
  window.addEventListener('offline', () => handleConnectionChange({ online: false }));

  console.log(`✅ Offline manager initialized (currently ${isOffline ? 'OFFLINE' : 'ONLINE'})`);
}

/**
 * Handle connection state change
 * @param {Object} data - Event data
 * @param {boolean} data.online - Online status
 */
function handleConnectionChange({ online }) {
  const wasOffline = isOffline;
  isOffline = !online;

  console.log(`📡 Connection changed: ${online ? 'ONLINE' : 'OFFLINE'}`);

  updateOfflineState();

  if (wasOffline && online) {
    // Came back online - sync queued operations
    console.log('🔄 Connection restored, syncing queued operations...');
    syncOfflineQueue();
  } else if (!wasOffline && !online) {
    // Went offline
    console.warn('⚠️ Connection lost');
  }
}

/**
 * Update UI based on offline state
 */
function updateOfflineState() {
  if (!offlineIndicator) return;

  if (isOffline) {
    offlineIndicator.classList.remove('hidden');
    showWarningNotification('⚠️ You are offline. Changes will be synced when connection is restored.', 0);
    updateQueueCount();
  } else {
    offlineIndicator.classList.add('hidden');
    if (queueCountElement) {
      queueCountElement.textContent = '';
    }
  }
}

/**
 * Update queue count in UI
 */
function updateQueueCount() {
  if (!queueCountElement) return;

  if (offlineQueue.length > 0) {
    queueCountElement.textContent = `${offlineQueue.length} pending`;
  } else {
    queueCountElement.textContent = '';
  }
}

/**
 * Queue an operation for when connection is restored
 * @param {Function} operation - Async operation to queue
 * @param {Object} context - Context data for the operation
 * @param {string} description - Human-readable description
 * @example
 * queueOfflineOperation(
 *   async (ctx) => await saveTask(ctx.task),
 *   { task: taskData },
 *   'Save task'
 * );
 */
export function queueOfflineOperation(operation, context = {}, description = 'Operation') {
  offlineQueue.push({
    operation,
    context,
    description,
    timestamp: Date.now()
  });

  console.log(`📥 Queued offline operation: ${description} (${offlineQueue.length} in queue)`);
  updateQueueCount();

  // Show notification
  showInfoNotification(`📥 Queued: ${description}`);
}

/**
 * Sync queued operations when online
 * @returns {Promise<Object>} Sync results
 */
async function syncOfflineQueue() {
  if (offlineQueue.length === 0) {
    console.log('✅ No offline operations to sync');
    return { success: 0, failed: 0 };
  }

  console.log(`📤 Syncing ${offlineQueue.length} offline operations...`);
  showInfoNotification(`🔄 Syncing ${offlineQueue.length} offline changes...`);

  const operations = [...offlineQueue];
  offlineQueue = [];

  let successCount = 0;
  let failCount = 0;
  const failedOps = [];

  for (const { operation, context, description, timestamp } of operations) {
    try {
      console.log(`🔄 Syncing: ${description}`);
      await operation(context);
      successCount++;
      console.log(`✅ Synced: ${description}`);
    } catch (error) {
      console.error(`❌ Failed to sync: ${description}`, error);
      failCount++;
      // Re-queue failed operations
      failedOps.push({ operation, context, description, timestamp });
    }
  }

  // Re-queue failed operations
  offlineQueue.push(...failedOps);
  updateQueueCount();

  // Show results
  if (successCount > 0) {
    showInfoNotification(`✅ Synced ${successCount} offline change${successCount > 1 ? 's' : ''}`);
  }

  if (failCount > 0) {
    showWarningNotification(
      `⚠️ ${failCount} change${failCount > 1 ? 's' : ''} failed to sync. Will retry later.`
    );
  }

  console.log(`📤 Sync complete: ${successCount} succeeded, ${failCount} failed`);

  return { success: successCount, failed: failCount };
}

/**
 * Manually trigger sync (useful for retry button)
 * @returns {Promise<Object>} Sync results
 */
export async function manualSync() {
  if (isOffline) {
    showWarningNotification('⚠️ Cannot sync while offline');
    return { success: 0, failed: 0 };
  }

  return await syncOfflineQueue();
}

/**
 * Check if currently offline
 * @returns {boolean} True if offline
 */
export function isCurrentlyOffline() {
  return isOffline;
}

/**
 * Get queued operations count
 * @returns {number} Number of queued operations
 */
export function getQueuedOperationsCount() {
  return offlineQueue.length;
}

/**
 * Get all queued operations (for debugging)
 * @returns {Array} Queued operations
 */
export function getQueuedOperations() {
  return offlineQueue.map(op => ({
    description: op.description,
    timestamp: new Date(op.timestamp).toISOString(),
    age: Date.now() - op.timestamp
  }));
}

/**
 * Clear all queued operations
 * Warning: This will discard all pending changes!
 */
export function clearQueue() {
  const count = offlineQueue.length;
  offlineQueue = [];
  updateQueueCount();
  console.warn(`🗑️ Cleared ${count} queued operations`);
}

// Expose utilities for debugging
if (typeof window !== 'undefined') {
  window.__offlineManager = {
    isOffline: isCurrentlyOffline,
    getQueueCount: getQueuedOperationsCount,
    getQueue: getQueuedOperations,
    manualSync,
    clearQueue
  };
}

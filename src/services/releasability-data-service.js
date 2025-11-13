/**
 * Releasability Data Service
 *
 * Handles data integration between Google Sheets, Supabase, and the releasability board.
 * - Loads projects from Google Sheets
 * - Detects project start dates
 * - Loads/saves tracking statuses from/to Supabase
 *
 * @module services/releasability-data-service
 */

import { fetchTasks } from './sheets-service.js';
import { loadFromCacheOrFetch } from './sheets-cache-service.js';
import { initializeSupabase, getSupabaseClient, sendRefreshSignal } from './supabase-service.js';
import { logger } from '../utils/logger.js';
import { parseDate, getMonday, getLocalDateString } from '../utils/date-utils.js';
import { DEFAULT_TRACKING_STATUS, PROJECT_SOURCE } from '../config/releasability-config.js';

// Supabase tables for releasability tracking
const RELEASABILITY_TABLE = 'releasability_tracking';
const MANUAL_WEEKS_TABLE = 'releasability_manual_weeks';

/**
 * Load projects from Google Sheets
 *
 * Fetches tasks from Google Sheets, groups them by project, and detects
 * the earliest week (start date) for each project.
 *
 * @returns {Promise<Array<Object>>} Array of project objects with weekMonday and department
 *
 * @example
 * const projects = await loadProjectsFromSheets();
 * // Returns: [{project: 'Project A', weekMonday: '2025-01-13', department: 'Mill', ...}]
 */
export async function loadProjectsFromSheets() {
  logger.info('📊 Loading projects from Google Sheets...');

  try {
    // Fetch all tasks from Google Sheets (via cache when possible)
    const tasks = await loadFromCacheOrFetch();
    logger.info(`  → Loaded ${tasks.length} tasks`);

    // Group tasks by project name
    const projectGroups = {};
    tasks.forEach(task => {
      const projectName = task.project.trim();
      if (!projectName) return; // Skip tasks without project name

      if (!projectGroups[projectName]) {
        projectGroups[projectName] = [];
      }
      projectGroups[projectName].push(task);
    });

    logger.info(`  → Found ${Object.keys(projectGroups).length} unique projects`);

    // Create project objects with earliest week as start date
    const projects = [];
    for (const [projectName, projectTasks] of Object.entries(projectGroups)) {
      // Find earliest actual date and earliest Monday date for this project
      // Use task.date field
      const dateInfo = projectTasks
        .map(task => {
          if (!task.date) return null;

          // Parse the date string
          const parsedDate = parseDate(task.date);
          if (!parsedDate) {
            logger.debug(`  → Skipping invalid date format for project "${projectName}": ${task.date}`);
            return null;
          }

          // Get Monday of the week containing this date
          const monday = getMonday(parsedDate);

          // Return both actual date and Monday, and keep reference to the task
          return {
            actualDate: getLocalDateString(parsedDate),
            mondayDate: getLocalDateString(monday),
            task: task
          };
        })
        .filter(info => info !== null); // Remove invalid dates

      if (dateInfo.length === 0) {
        logger.warn(`  → Skipping project "${projectName}": No valid dates found`);
        continue;
      }

      // Sort by actual date to find earliest
      const sortedByActual = dateInfo.sort((a, b) => a.actualDate.localeCompare(b.actualDate));
      const earliestActualDate = sortedByActual[0].actualDate;

      // Sort by Monday date to find earliest week
      const sortedByMonday = [...dateInfo].sort((a, b) => a.mondayDate.localeCompare(b.mondayDate));
      const earliestWeek = sortedByMonday[0].mondayDate;

      // Get department from the earliest "Mill" or "Form Out" task
      // Filter for only Mill/Form Out tasks, then find the earliest one
      const relevantDeptTasks = sortedByActual.filter(info => {
        const dept = info.task.department;
        return dept === 'Mill' || dept === 'Form Out';
      });

      let department;
      if (relevantDeptTasks.length > 0) {
        // Use the earliest Mill or Form Out task
        department = relevantDeptTasks[0].task.department;
      } else {
        // Fallback: use the earliest task's department (even if not Mill/Form Out)
        department = sortedByActual[0].task.department;
      }

      // Only include projects with Mill or Form Out department
      if (department === 'Mill' || department === 'Form Out') {
        projects.push({
          project: projectName,
          weekMonday: earliestWeek,
          actualStartDate: earliestActualDate,
          department: department,
          source: PROJECT_SOURCE.SHEETS
        });
      }
      // Projects not in Mill/Form Out are silently skipped
    }

    logger.info(`  → Created ${projects.length} releasability board projects (filtered for Mill/Form Out only)`);
    return projects;

  } catch (error) {
    logger.error('❌ Failed to load projects from Google Sheets:', error);
    throw error;
  }
}

/**
 * Get the most common department from a list of tasks
 * @param {Array<Object>} tasks - Array of task objects
 * @returns {string|null} Most common department name or null
 */
function getMostCommonDepartment(tasks) {
  const departmentCounts = {};

  tasks.forEach(task => {
    const dept = task.department;
    if (dept) {
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    }
  });

  // Find department with highest count
  let maxCount = 0;
  let mostCommon = null;

  for (const [dept, count] of Object.entries(departmentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = dept;
    }
  }

  return mostCommon;
}

/**
 * Load tracking statuses from Supabase
 *
 * Fetches all saved tracking statuses for releasability board projects.
 * Returns a map of project+week -> tracking status object.
 *
 * @returns {Promise<Map<string, Object>>} Map of project keys to tracking status objects
 *
 * @example
 * const statuses = await loadTrackingStatuses();
 * // Returns: Map { 'Project A|2025-01-13' => {trackingStatus: {...}, updatedAt: '...'} }
 */
export async function loadTrackingStatuses() {
  logger.info('💾 Loading tracking statuses from Supabase...');

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Fetch all tracking records
    const { data, error } = await client
      .from(RELEASABILITY_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Convert to map for easy lookup
    const statusMap = new Map();
    data.forEach(record => {
      const key = `${record.project}|${record.week_monday}`;
      statusMap.set(key, {
        trackingStatus: record.tracking_status,
        updatedAt: record.updated_at,
        source: record.source,
        department: record.department,
        weekMonday: record.week_monday,
        manualWeekId: record.manual_week_id || null,
        project: record.project
      });
    });

    logger.info(`  → Loaded ${statusMap.size} tracking status records`);
    return statusMap;

  } catch (error) {
    logger.error('❌ Failed to load tracking statuses:', error);
    // Don't throw - return empty map so the app can continue
    return new Map();
  }
}

/**
 * Save tracking status to Supabase
 *
 * Saves or updates a project's tracking status in Supabase.
 * Uses upsert to handle both create and update cases.
 *
 * @param {Object} project - Project object with project name, weekMonday, and trackingStatus
 * @returns {Promise<boolean>} True if save successful
 *
 * @example
 * await saveTrackingStatus({
 *   project: 'Project A',
 *   weekMonday: '2025-01-13',
 *   trackingStatus: {...}
 * });
 */
export async function saveTrackingStatus(project) {
  logger.debug(`💾 Saving tracking status for "${project.project}"...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Upsert tracking status
    const { data, error } = await client
      .from(RELEASABILITY_TABLE)
      .upsert({
        project: project.project,
        week_monday: project.weekMonday,
        manual_week_id: project.manualWeekId || null,
        tracking_status: project.trackingStatus,
        department: project.department,
        source: project.source,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project,week_monday' // Update if exists
      });

    if (error) {
      throw error;
    }

    logger.debug(`  → Tracking status saved successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'releasability_status_updated',
      project: project.project,
      weekMonday: project.weekMonday
    });

    return true;

  } catch (error) {
    logger.error(`❌ Failed to save tracking status for "${project.project}":`, error);
    throw error;
  }
}

/**
 * Delete tracking status from Supabase
 *
 * Removes a project's tracking status record from Supabase.
 *
 * @param {string} projectName - Project name
 * @param {string} weekMonday - Week Monday date
 * @returns {Promise<boolean>} True if deletion successful
 *
 * @example
 * await deleteTrackingStatus('Project A', '2025-01-13');
 */
export async function deleteTrackingStatus(projectName, weekMonday) {
  logger.debug(`🗑️ Deleting tracking status for "${projectName}"...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Delete tracking status
    const { error } = await client
      .from(RELEASABILITY_TABLE)
      .delete()
      .eq('project', projectName)
      .eq('week_monday', weekMonday);

    if (error) {
      throw error;
    }

    logger.debug(`  → Tracking status deleted successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'releasability_project_deleted',
      project: projectName,
      weekMonday: weekMonday
    });

    return true;

  } catch (error) {
    logger.error(`❌ Failed to delete tracking status for "${projectName}":`, error);
    throw error;
  }
}

/**
 * Find existing project records by name (ignoring week)
 *
 * Searches for any existing Supabase records matching a project name,
 * regardless of the week. Only finds SHEETS source projects, not MANUAL.
 * Returns sorted by updatedAt (most recent first).
 *
 * @param {string} projectName - The project name to search for
 * @param {Map<string, Object>} trackingStatuses - Map of all tracking statuses
 * @returns {Array<Object>} Array of matching records with their keys, sorted by updatedAt
 */
function findProjectByName(projectName, trackingStatuses) {
  const matches = [];

  trackingStatuses.forEach((record, key) => {
    // Only match SHEETS projects (not MANUAL ones)
    if (record.project === projectName && record.source === PROJECT_SOURCE.SHEETS) {
      matches.push({
        key,
        record
      });
    }
  });

  // Sort by updatedAt, most recent first
  matches.sort((a, b) => {
    const dateA = new Date(a.record.updatedAt);
    const dateB = new Date(b.record.updatedAt);
    return dateB - dateA; // Descending order
  });

  return matches;
}

/**
 * Load all releasability data
 *
 * Combines data from Google Sheets and Supabase to create the complete
 * releasability board state.
 *
 * @returns {Promise<Array<Object>>} Array of project objects with tracking statuses
 *
 * @example
 * const projects = await loadAllReleasabilityData();
 * // Returns complete projects with tracking statuses merged from Supabase
 */
export async function loadAllReleasabilityData() {
  logger.info('🔄 Loading all releasability data...');

  try {
    // Load projects from Google Sheets and tracking statuses from Supabase in parallel
    const [sheetsProjects, trackingStatuses] = await Promise.all([
      loadProjectsFromSheets(),
      loadTrackingStatuses()
    ]);

    // Track which Supabase records we've used
    const usedSupabaseKeys = new Set();

    // Track old records that need to be deleted after migration
    const migratedKeys = new Set();

    // Merge tracking statuses into Sheets projects
    const projects = sheetsProjects.map(project => {
      const key = `${project.project}|${project.weekMonday}`;

      // First, try exact match lookup
      let saved = trackingStatuses.get(key);

      // If no exact match, check if project exists with a different week (date change migration)
      if (!saved) {
        const oldRecords = findProjectByName(project.project, trackingStatuses);

        if (oldRecords.length > 0) {
          // Use the most recent record's tracking status
          const mostRecent = oldRecords[0];
          saved = mostRecent.record;

          // Track the old key for deletion
          migratedKeys.add(mostRecent.key);

          // Log the date change detection
          logger.info(`  🔄 Date change detected for "${project.project}": ${mostRecent.record.weekMonday} → ${project.weekMonday}`);
          logger.info(`     Migrating tracking status: ${JSON.stringify(saved.trackingStatus)}`);
        }
      } else {
        // Exact match found - mark as used
        usedSupabaseKeys.add(key);
      }

      // Generate unique ID
      const id = `project_${project.project}_${project.weekMonday}`.replace(/\s+/g, '_');

      return {
        id,
        project: project.project,
        weekMonday: project.weekMonday,
        actualStartDate: project.actualStartDate,
        department: project.department,
        source: project.source,
        manualWeekId: saved && saved.manualWeekId ? saved.manualWeekId : null,
        trackingStatus: saved ? saved.trackingStatus : { ...DEFAULT_TRACKING_STATUS },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString() // Update timestamp when migrating
      };
    });

    // Add manual projects from Supabase that don't exist in Sheets
    trackingStatuses.forEach((record, key) => {
      // Skip if this record was already used for a Sheets project
      if (usedSupabaseKeys.has(key)) {
        return;
      }

      // Skip if this record was migrated (will be deleted)
      if (migratedKeys.has(key)) {
        return;
      }

      // Only add if it's a manual project
      if (record.source === PROJECT_SOURCE.MANUAL) {
        const id = `project_${record.project}_${record.weekMonday}`.replace(/\s+/g, '_');

        projects.push({
          id,
          project: record.project,
          weekMonday: record.weekMonday,
          actualStartDate: record.weekMonday, // Manual projects use weekMonday as start date
          department: record.department,
          source: record.source,
          manualWeekId: record.manualWeekId || null,
          trackingStatus: record.trackingStatus || { ...DEFAULT_TRACKING_STATUS },
          createdAt: new Date().toISOString(),
          updatedAt: record.updatedAt || new Date().toISOString()
        });
      }
    });

    // Delete old week records that were migrated
    if (migratedKeys.size > 0) {
      logger.info(`🗑️ Deleting ${migratedKeys.size} old week records after migration...`);

      for (const oldKey of migratedKeys) {
        const [projectName, weekMonday] = oldKey.split('|');
        try {
          await deleteTrackingStatus(projectName, weekMonday);
        } catch (error) {
          logger.error(`  ✗ Failed to delete old record: "${projectName}" (${weekMonday})`, error);
        }
      }
    }

    logger.info(`✅ Loaded ${projects.length} projects with tracking statuses`);
    return projects;

  } catch (error) {
    logger.error('❌ Failed to load all releasability data:', error);
    throw error;
  }
}

/**
 * Load manual weeks from Supabase
 *
 * Fetches all manually added week dividers with custom names.
 *
 * @returns {Promise<Array<Object>>} Array of manual week objects with id, name, and position
 * @example
 * // Returns: [{id: '1', name: 'Future Projects', position: 0}, ...]
 */
export async function loadManualWeeks() {
  logger.info('📅 Loading manual weeks from Supabase...');

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Fetch all manual weeks
    const { data, error } = await client
      .from(MANUAL_WEEKS_TABLE)
      .select('id, custom_name, position, created_at')
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    const weeks = data.map(record => ({
      id: record.id,
      name: record.custom_name,
      position: record.position,
      createdAt: record.created_at
    }));

    logger.info(`  → Loaded ${weeks.length} manual weeks`);
    return weeks;

  } catch (error) {
    logger.error('❌ Failed to load manual weeks:', error);
    // Don't throw - return empty array so the app can continue
    return [];
  }
}

/**
 * Save a manual week to Supabase
 *
 * @param {string} customName - Custom name for the week divider
 * @param {number} position - Position in the list (for ordering)
 * @returns {Promise<Object>} The created manual week object with id
 */
export async function saveManualWeek(customName, position) {
  logger.debug(`📅 Saving manual week: "${customName}" at position ${position}`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Insert manual week
    const { data, error } = await client
      .from(MANUAL_WEEKS_TABLE)
      .insert({
        custom_name: customName,
        position: position,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.debug(`  → Manual week saved successfully with ID: ${data.id}`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'manual_week_created',
      weekId: data.id,
      customName: customName
    });

    return {
      id: data.id,
      name: data.custom_name,
      position: data.position,
      createdAt: data.created_at
    };

  } catch (error) {
    logger.error(`❌ Failed to save manual week:`, error);
    throw error;
  }
}

/**
 * Delete a manual week from Supabase
 *
 * @param {string} weekId - ID of the manual week to delete
 * @returns {Promise<boolean>} True if deletion successful
 */
export async function deleteManualWeek(weekId) {
  logger.debug(`🗑️ Deleting manual week: ${weekId}`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Delete manual week
    const { error } = await client
      .from(MANUAL_WEEKS_TABLE)
      .delete()
      .eq('id', weekId);

    if (error) {
      throw error;
    }

    logger.debug(`  → Manual week deleted successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'manual_week_deleted',
      weekId: weekId
    });

    return true;

  } catch (error) {
    logger.error(`❌ Failed to delete manual week:`, error);
    throw error;
  }
}

/**
 * Update manual week positions in Supabase
 *
 * @param {Array<{id: string, position: number}>} updates - Array of week IDs with new positions
 * @returns {Promise<boolean>} True if update successful
 */
export async function updateManualWeekPositions(updates) {
  logger.debug(`📅 Updating ${updates.length} manual week positions...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Update each week's position
    const promises = updates.map(({ id, position }) =>
      client
        .from(MANUAL_WEEKS_TABLE)
        .update({ position })
        .eq('id', id)
    );

    const results = await Promise.all(promises);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(`Failed to update ${errors.length} positions`);
    }

    logger.debug(`  → Manual week positions updated successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'manual_week_positions_updated',
      updateCount: updates.length
    });

    return true;

  } catch (error) {
    logger.error(`❌ Failed to update manual week positions:`, error);
    throw error;
  }
}

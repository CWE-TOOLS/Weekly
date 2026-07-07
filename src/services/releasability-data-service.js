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
import { DEFAULT_TRACKING_STATUS, PROJECT_SOURCE, STATUS } from '../config/releasability-config.js';
import { normalizeProjectName } from '../utils/ui-utils.js';
import { loadAllProjects } from './projects-service.js';

// Supabase tables for releasability tracking
const RELEASABILITY_TABLE = 'releasability_tracking';
const MANUAL_WEEKS_TABLE = 'releasability_manual_weeks';

/**
 * Generate a consistent project key for lookups and storage
 *
 * Creates a normalized key in the format: "normalized-project-name|weekMonday"
 * This ensures consistent key generation across all operations.
 *
 * @param {string} projectName - The project name (will be normalized)
 * @param {string} weekMonday - The week Monday date string
 * @returns {string} Normalized key for Map/cache lookups
 */
function generateProjectKey(projectName, weekMonday) {
  const normalized = normalizeProjectName(projectName);
  return `${normalized}|${weekMonday}`;
}

/**
 * Normalize a project number for keys and storage (trim only — leading zeros
 * like '0383' are significant).
 * @param {*} value
 * @returns {string}
 */
function normalizeNumberField(value) {
  return (value || '').toString().trim();
}

/**
 * Normalize a cast number for keys and storage. Trim + upper-case so '1a' and
 * '1A' collapse to one casting.
 * @param {*} value
 * @returns {string}
 */
function normalizeCastingNumber(value) {
  return (value || '').toString().trim().toUpperCase();
}

/**
 * Generate a stable casting key from the structured project/cast numbers.
 *
 * Unlike generateProjectKey (which is schedule-dependent because it embeds the
 * week), this key is derived only from the Google Sheet's project number (col H)
 * and cast number (col I) — so it survives reschedules AND project renames.
 *
 * Returns null when either number is missing; callers fall back to the legacy
 * name+week key in that case, so un-numbered castings are never stranded.
 *
 * @param {string} projectNumber - Project number (e.g. '0383')
 * @param {string} castingNumber - Cast number (e.g. '13', '1A')
 * @returns {string|null} Stable key "projectNumber#castNumber" or null
 */
function generateCastingKey(projectNumber, castingNumber) {
  const p = normalizeNumberField(projectNumber);
  const c = normalizeCastingNumber(castingNumber);
  if (!p || !c) return null;
  return `${p}#${c}`;
}

/**
 * Whether a board project resolves to a stable casting key (has both project#
 * and cast#). Exported so UI move handlers can decide whether a reschedule needs
 * a legacy delete-then-save (un-numbered: the key is name+week, so it changes) or
 * can rely on the in-place casting-key upsert (numbered: the key is unchanged).
 *
 * @param {Object} project - A board project object
 * @returns {string|null} The casting key, or null when both numbers aren't present
 */
export function getCastingKey(project) {
  return generateCastingKey(project && project.projectNumber, project && project.castingNumber);
}

/**
 * How "advanced" each milestone status is, so that when two rows for the same
 * casting are collapsed we keep the most-progressed value per item. Mirrors the
 * one-time SQL merge used to heal the first duplicate that surfaced this bug.
 */
const STATUS_RANK = {
  [STATUS.COMPLETE]: 4,
  [STATUS.IN_PROGRESS]: 3,
  [STATUS.NOT_APPLICABLE]: 2,
  [STATUS.INCOMPLETE]: 1
};

/**
 * Merge two tracking_status objects, keeping the most-advanced value per item.
 * Used when folding a duplicate casting row into the row that owns the stable
 * key, so no milestone progress from either row is lost.
 *
 * @param {Object} primary
 * @param {Object} secondary
 * @returns {Object} merged status (most-advanced wins per item)
 */
function mergeTrackingStatus(primary, secondary) {
  const a = primary && typeof primary === 'object' ? primary : {};
  const b = secondary && typeof secondary === 'object' ? secondary : {};
  const merged = {};
  for (const item of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ra = STATUS_RANK[a[item]] || 0;
    const rb = STATUS_RANK[b[item]] || 0;
    merged[item] = ra >= rb ? (a[item] != null ? a[item] : b[item]) : b[item];
  }
  return merged;
}

/**
 * Collapse a duplicate casting: merge `loser`'s milestone progress into `keeper`
 * (most-advanced wins per item), stamp `keeper` with the stable casting key, then
 * delete `loser`. No progress from either row is lost, and because `keeper` keeps
 * its own (project, week_monday) the primary-key and casting-unique constraints
 * are never violated. The keeper is matched by its own casting key when it has
 * one (exact row, regardless of siblings); otherwise by name+week restricted to
 * un-keyed rows. The loser DELETE is likewise restricted to un-keyed rows so it
 * can never take out a keyed sibling casting sharing the same name+week.
 *
 * @returns {Promise<boolean>}
 */
async function mergeAndDeleteLegacy(client, keeper, loser, key) {
  const merged = mergeTrackingStatus(keeper.tracking_status, loser.tracking_status);

  let updQuery = client
    .from(RELEASABILITY_TABLE)
    .update({
      project_number: key.project_number,
      casting_number: key.casting_number,
      tracking_status: merged,
      updated_at: new Date().toISOString()
    });
  if (keeper.project_number && keeper.casting_number) {
    updQuery = updQuery
      .eq('project_number', keeper.project_number)
      .eq('casting_number', keeper.casting_number);
  } else {
    updQuery = updQuery
      .eq('project', keeper.project)
      .eq('week_monday', keeper.week_monday)
      .is('casting_number', null);
  }
  const upd = await updQuery;
  if (upd.error) throw upd.error;

  const del = await client
    .from(RELEASABILITY_TABLE)
    .delete()
    .eq('project', loser.project)
    .eq('week_monday', loser.week_monday)
    .is('casting_number', null);
  if (del.error) throw del.error;

  logger.debug(`  ⤵️ Merged duplicate "${loser.project}" (${loser.week_monday}) into "${keeper.project}" (${keeper.week_monday})`);
  return true;
}

/**
 * Backfill a legacy tracking row with its stable project#/cast# numbers, IN PLACE,
 * with zero data loss and no constraint collisions.
 *
 * The naive version simply UPDATEd the legacy row to stamp the numbers and refresh
 * the week. That throws 409 whenever the upgrade would collide with another row:
 *   - refreshing week_monday hits the primary key (project, week_monday) if a
 *     current-week row with the same name already exists; or
 *   - stamping (project_number, casting_number) hits the casting-unique constraint
 *     if another row already owns that key.
 * Either way the legacy row was left stranded as an orphan duplicate (the root
 * cause of the "failed to save" 23505 we had to clean up by hand).
 *
 * This version reconciles first: if a different row already owns the target week
 * or the casting key, it folds the legacy row's progress into that row and deletes
 * the legacy duplicate (self-healing). Only when there's no conflict does it do the
 * plain in-place UPDATE. Future loads then exact-match the casting key and skip
 * this path entirely.
 *
 * @param {Object} bf - { originalProject, oldWeekMonday, newWeekMonday, projectNumber, castingNumber }
 * @returns {Promise<boolean>}
 */
async function backfillCastingNumbers(bf) {
  if (!getSupabaseClient()) {
    await initializeSupabase();
  }
  const client = getSupabaseClient();

  const projectNumber = normalizeNumberField(bf.projectNumber);
  const castingNumber = normalizeCastingNumber(bf.castingNumber);
  const newWeek = bf.newWeekMonday;
  const key = { project_number: projectNumber, casting_number: castingNumber };

  // The legacy row we intend to upgrade, matched by its name+week as it stood when
  // this load began. If it's already gone (healed by a prior load or another tab),
  // there's nothing to do. Restricted to un-keyed rows: a row that already carries
  // a casting key belongs to a (possibly different) casting and must never be
  // re-stamped with this one's numbers.
  const legacyRes = await client
    .from(RELEASABILITY_TABLE)
    .select('*')
    .eq('project', bf.originalProject)
    .eq('week_monday', bf.oldWeekMonday)
    .is('casting_number', null);
  if (legacyRes.error) throw legacyRes.error;
  const legacy = legacyRes.data && legacyRes.data[0];
  if (!legacy) return true;

  const sameRow = (row) =>
    !!row && row.project === legacy.project && row.week_monday === legacy.week_monday;

  // 1) Casting key already owned by a different row → stamping it here would
  //    violate the casting-unique constraint. Fold progress into the owner instead.
  const keyRes = await client
    .from(RELEASABILITY_TABLE)
    .select('*')
    .eq('project_number', projectNumber)
    .eq('casting_number', castingNumber);
  if (keyRes.error) throw keyRes.error;
  const keyHolder = keyRes.data && keyRes.data[0];
  if (keyHolder && !sameRow(keyHolder)) {
    return mergeAndDeleteLegacy(client, keyHolder, legacy, key);
  }

  // 2) We'd refresh the legacy row's week to the current schedule, but a different
  //    UN-KEYED row already sits at (project, newWeek) → moving it there violates
  //    the legacy uniqueness. Fold progress into that current-week row instead.
  //    Keyed rows at the target week are ignored: they are sibling castings, and
  //    merging into one would overwrite its key/progress. (Pre-migration, a keyed
  //    sibling holding the PK slot makes the in-place UPDATE below fail with
  //    23505 — logged and skipped — which is strictly better than destroying it.)
  if (newWeek && newWeek !== legacy.week_monday) {
    const weekRes = await client
      .from(RELEASABILITY_TABLE)
      .select('*')
      .eq('project', legacy.project)
      .eq('week_monday', newWeek)
      .is('casting_number', null);
    if (weekRes.error) throw weekRes.error;
    const weekHolder = weekRes.data && weekRes.data[0];
    if (weekHolder && !sameRow(weekHolder)) {
      return mergeAndDeleteLegacy(client, weekHolder, legacy, key);
    }
  }

  // 3) No conflict — upgrade the legacy row in place onto the stable key and
  //    refresh its week. Next load exact-matches the casting key and skips this.
  //    The .is('casting_number', null) guard pins the UPDATE to the un-keyed
  //    legacy row even if a keyed sibling shares the same name+week.
  const { error } = await client
    .from(RELEASABILITY_TABLE)
    .update({
      project_number: projectNumber,
      casting_number: castingNumber,
      week_monday: newWeek,
      updated_at: new Date().toISOString()
    })
    .eq('project', legacy.project)
    .eq('week_monday', legacy.week_monday)
    .is('casting_number', null);

  if (error) {
    throw error;
  }
  return true;
}

/**
 * Load projects from Google Sheets
 *
 * Fetches tasks from Google Sheets, groups them by project, and detects
 * the earliest week (start date) for each project.
 *
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data from Google Sheets
 * @returns {Promise<Array<Object>>} Array of project objects with weekMonday and department
 *
 * @example
 * const projects = await loadProjectsFromSheets();
 * // Returns: [{project: 'Project A', weekMonday: '2025-01-13', department: 'Mill', ...}]
 */
export async function loadProjectsFromSheets(forceRefresh = false) {
  logger.debug(`📊 Loading projects from Google Sheets${forceRefresh ? ' (force refresh)' : ''}...`);

  try {
    // Fetch all tasks from Google Sheets (via cache when possible)
    const tasks = await loadFromCacheOrFetch(forceRefresh, 'primary', fetchTasks);
    logger.debug(`  → Loaded ${tasks.length} tasks`);

    // Group tasks by project name
    const projectGroups = {};
    tasks.forEach(task => {
      const projectName = normalizeProjectName(task.project);
      if (!projectName) return; // Skip tasks without project name

      if (!projectGroups[projectName]) {
        projectGroups[projectName] = [];
      }
      projectGroups[projectName].push(task);
    });

    logger.debug(`  → Found ${Object.keys(projectGroups).length} unique projects`);

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

      // IMPORTANT: Filter for ONLY Mill/Form Out tasks FIRST
      // The releasability board only tracks Mill and Form Out work
      const relevantDeptTasks = dateInfo.filter(info => {
        const dept = info.task.department;
        return dept === 'Mill' || dept === 'Form Out';
      });

      // Skip project if it has no Mill or Form Out tasks
      if (relevantDeptTasks.length === 0) {
        logger.debug(`  → Skipping project "${projectName}": No Mill or Form Out tasks found`);
        continue;
      }

      // Sort by actual date to find earliest MILL/FORM OUT task
      const sortedByActual = relevantDeptTasks.sort((a, b) => a.actualDate.localeCompare(b.actualDate));
      const earliestActualDate = sortedByActual[0].actualDate;

      // Sort by Monday date to find earliest week from MILL/FORM OUT tasks only
      const sortedByMonday = [...relevantDeptTasks].sort((a, b) => a.mondayDate.localeCompare(b.mondayDate));
      const earliestWeek = sortedByMonday[0].mondayDate;

      // Get department from the earliest Mill or Form Out task
      const department = sortedByActual[0].task.department;

      // Project number (col H) and cast number (col I) come straight from the
      // Google Sheet import. Use the first task that carries each; null if the
      // sheet left it blank. These structured numbers are the durable identity
      // for tracking state (see generateCastingKey) — names and weeks can change,
      // the numbers don't.
      const numberTask = projectTasks.find(t => t.projectNumber);
      const projectNumber = numberTask ? numberTask.projectNumber : null;
      const castTask = projectTasks.find(t => t.castingNumber);
      const castingNumber = castTask ? castTask.castingNumber : null;

      // Add project to releasability board
      if (true) { // Always true now since we already filtered for Mill/Form Out
        projects.push({
          project: projectName,
          projectNumber: projectNumber,
          castingNumber: castingNumber,
          weekMonday: earliestWeek,
          actualStartDate: earliestActualDate,
          department: department,
          source: PROJECT_SOURCE.SHEETS
        });
      }
      // Projects not in Mill/Form Out are silently skipped
    }

    logger.debug(`  → Created ${projects.length} releasability board projects (filtered for Mill/Form Out only)`);
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
  logger.debug('💾 Loading tracking statuses from Supabase...');

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
      // Normalize project name for consistent lookups
      const normalizedProject = normalizeProjectName(record.project);

      // Prefer the stable casting key (project#+cast#) when the row has been
      // stamped with both numbers; fall back to the legacy name+week key for
      // rows that predate the re-key (they get backfilled on load — see
      // loadAllReleasabilityData).
      const castingKey = generateCastingKey(record.project_number, record.casting_number);
      const key = castingKey || generateProjectKey(record.project, record.week_monday);

      statusMap.set(key, {
        trackingStatus: record.tracking_status,
        updatedAt: record.updated_at,
        source: record.source,
        department: record.department,
        weekMonday: record.week_monday,
        manualWeekId: record.manual_week_id || null,
        projectNumber: record.project_number || null,
        castingNumber: record.casting_number || null,
        project: normalizedProject,  // Normalized name for display/comparison
        originalProject: record.project  // Keep original DB name for deletion
      });
    });

    logger.debug(`  → Loaded ${statusMap.size} tracking status records`);
    return statusMap;

  } catch (error) {
    logger.error('❌ Failed to load tracking statuses:', error);
    // Throw rather than degrade: returning an empty map used to render the
    // board with every milestone unchecked — actively misleading — while the
    // freshness chip claimed the data was current. Failing the load keeps the
    // last good render and lets the auto-refresh engine retry.
    throw error;
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

    // Normalize project name for consistent database storage
    const normalizedProjectName = normalizeProjectName(project.project);

    // Structured identity (project#+cast#). When present, it's the conflict
    // target so state stays attached to the casting across reschedules/renames.
    // When absent (sheet left a number blank), fall back to the legacy name+week
    // target so the row is never stranded.
    const castingKey = generateCastingKey(project.projectNumber, project.castingNumber);

    // The row we want to persist. We always write BOTH the legacy columns
    // (project, week_monday — still NOT NULL) and the structured numbers, so a
    // row is complete regardless of which key it's matched on.
    const row = {
      project: normalizedProjectName,
      week_monday: project.weekMonday,
      project_number: normalizeNumberField(project.projectNumber) || null,
      casting_number: normalizeCastingNumber(project.castingNumber) || null,
      manual_week_id: project.manualWeekId || null,
      tracking_status: project.trackingStatus,
      department: project.department,
      source: project.source,
      updated_at: new Date().toISOString()
    };

    if (castingKey) {
      // The casting key (project#+cast#) is the preferred identity. But a plain
      // upsert(onConflict: project_number,casting_number) breaks when an UN-KEYED
      // legacy row already sits at this (project, week_monday): the casting key
      // doesn't match it, so Postgres tries to INSERT and trips the
      // (project, week_monday) primary key (error 23505). So reconcile by hand:
      //   (a) update the row that already owns this casting key, else
      //   (b) attach the key to the legacy name+week row in place, else
      //   (c) insert a brand-new casting.
      const byKey = await client
        .from(RELEASABILITY_TABLE)
        .update(row)
        .eq('project_number', row.project_number)
        .eq('casting_number', row.casting_number)
        .select('project');
      if (byKey.error) throw byKey.error;

      if (!byKey.data || byKey.data.length === 0) {
        // (b) may only claim a GENUINE legacy row — one that has never been
        // stamped with a casting key. Without the .is('casting_number', null)
        // guard, saving a NEW casting (e.g. cast 7) into a week that already
        // holds a keyed sibling (cast 6, same derived name + week) matched the
        // sibling's row here and silently overwrote it.
        const byNameWeek = await client
          .from(RELEASABILITY_TABLE)
          .update(row)
          .eq('project', normalizedProjectName)
          .eq('week_monday', project.weekMonday)
          .is('casting_number', null)
          .select('project');
        if (byNameWeek.error) throw byNameWeek.error;

        if (!byNameWeek.data || byNameWeek.data.length === 0) {
          const inserted = await client.from(RELEASABILITY_TABLE).insert(row);
          if (inserted.error) throw inserted.error;
        }
      }
    } else {
      // No structured number yet — fall back to the legacy name+week key so the
      // row is never stranded. Split into update-then-insert instead of
      // upsert(onConflict: 'project,week_monday'): once the multi-casting
      // migration drops that primary key, the upsert has no arbiter constraint
      // and errors. The .is('casting_number', null) guard also keeps a legacy
      // save from ever claiming a keyed sibling casting's row.
      const byNameWeek = await client
        .from(RELEASABILITY_TABLE)
        .update(row)
        .eq('project', normalizedProjectName)
        .eq('week_monday', project.weekMonday)
        .is('casting_number', null)
        .select('project');
      if (byNameWeek.error) throw byNameWeek.error;

      if (!byNameWeek.data || byNameWeek.data.length === 0) {
        const inserted = await client.from(RELEASABILITY_TABLE).insert(row);
        if (inserted.error) throw inserted.error;
      }
    }

    logger.debug(`  → Tracking status saved successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'releasability_status_updated',
      project: normalizedProjectName,
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
export async function deleteTrackingStatus(projectName, weekMonday, projectNumber = null, castingNumber = null) {
  logger.debug(`🗑️ Deleting tracking status for "${projectName}" (${weekMonday})...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Preferred: delete by the stable casting key when we have both numbers —
    // that targets the row regardless of its current name/week.
    const castingKey = generateCastingKey(projectNumber, castingNumber);
    if (castingKey) {
      const { error, count } = await client
        .from(RELEASABILITY_TABLE)
        .delete({ count: 'exact' })
        .eq('project_number', normalizeNumberField(projectNumber))
        .eq('casting_number', normalizeCastingNumber(castingNumber));

      if (error) {
        throw error;
      }

      if (count > 0) {
        logger.debug(`  → Tracking status deleted successfully (casting key ${castingKey})`);
        await sendRefreshSignal({
          action: 'releasability_project_deleted',
          project: normalizeProjectName(projectName),
          weekMonday: weekMonday
        });
        return true;
      }

      logger.warn(`  ⚠️ No casting-keyed record for ${castingKey}; trying legacy name+week...`);
    }

    // Legacy fallback: delete by normalized name + week (then original name + week
    // for old non-normalized rows). Restricted to un-keyed rows: a name+week
    // delete must never take out a keyed sibling casting that happens to share
    // the same derived name and week. (Un-keyed targets are still matched — their
    // casting_number is NULL by definition.)
    const normalizedProjectName = normalizeProjectName(projectName);
    let { error, count } = await client
      .from(RELEASABILITY_TABLE)
      .delete({ count: 'exact' })
      .eq('project', normalizedProjectName)
      .eq('week_monday', weekMonday)
      .is('casting_number', null);

    // If no rows deleted and the name was different after normalization,
    // try with the original name (for old non-normalized records)
    if (count === 0 && normalizedProjectName !== projectName) {
      const result = await client
        .from(RELEASABILITY_TABLE)
        .delete({ count: 'exact' })
        .eq('project', projectName)
        .eq('week_monday', weekMonday)
        .is('casting_number', null);
      error = result.error;
      if (result.count === 0) {
        logger.warn(`  ⚠️ No records found to delete for "${projectName}" (${weekMonday})`);
      }
    }

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
  // Normalize the search parameter for consistent comparison
  const normalizedSearchName = normalizeProjectName(projectName);

  trackingStatuses.forEach((record, key) => {
    // Only match SHEETS projects (not MANUAL ones)
    // Note: record.project is already normalized from loadTrackingStatuses
    // Skip records that already carry a casting key: those are matched exactly
    // by key in loadAllReleasabilityData step 1, so if we're here they belong
    // to a DIFFERENT casting of the same project — adopting one would show its
    // progress on the wrong casting and re-stamp its row via the backfill.
    if (
      record.project === normalizedSearchName &&
      record.source === PROJECT_SOURCE.SHEETS &&
      !generateCastingKey(record.projectNumber, record.castingNumber)
    ) {
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
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data from Google Sheets
 * @returns {Promise<Array<Object>>} Array of project objects with tracking statuses
 *
 * @example
 * const projects = await loadAllReleasabilityData();
 * // Returns complete projects with tracking statuses merged from Supabase
 */
export async function loadAllReleasabilityData(forceRefresh = false) {
  logger.debug(`🔄 Loading all releasability data${forceRefresh ? ' (force refresh)' : ''}...`);

  try {
    // Load Sheets projects, Supabase tracking, and the portal's master project
    // list (project# → authoritative name) in parallel. loadAllProjects() returns
    // [] on any failure, so a portal outage degrades to the Sheet name, never an error.
    const [sheetsProjects, trackingStatuses, portalProjects] = await Promise.all([
      loadProjectsFromSheets(forceRefresh),
      loadTrackingStatuses(),
      loadAllProjects()
    ]);

    // Map project number → authoritative portal name for display lookups. The
    // portal `projects` table is the source of truth for names; the Google Sheet
    // name is only a fallback when a casting has no project# or no portal match.
    const portalNameByNumber = new Map();
    (portalProjects || []).forEach(p => {
      const num = normalizeNumberField(p.project_number);
      if (num && p.project_name) {
        portalNameByNumber.set(num, p.project_name);
      }
    });

    // Track which Supabase records we've consumed for a Sheets casting, so the
    // manual-projects pass below doesn't re-add them as phantom rows.
    const usedSupabaseKeys = new Set();

    // Legacy rows recognized as belonging to a numbered casting but not yet
    // stamped with project#/cast#. We backfill these IN PLACE (UPDATE, never
    // delete) so existing milestone state is upgraded onto the stable casting key
    // with zero data loss. Keyed by casting key to avoid stamping a casting twice
    // in one load.
    const pendingBackfills = new Map();

    // Merge tracking statuses into Sheets projects
    const projects = sheetsProjects.map(project => {
      const castingKey = generateCastingKey(project.projectNumber, project.castingNumber);
      const legacyKey = generateProjectKey(project.project, project.weekMonday);

      let saved = null;

      // 1) Preferred: exact match on the stable casting key (project#+cast#).
      if (castingKey && trackingStatuses.has(castingKey)) {
        saved = trackingStatuses.get(castingKey);
        usedSupabaseKeys.add(castingKey);
      } else {
        // 2) Legacy exact match on name+week.
        saved = trackingStatuses.get(legacyKey);
        if (saved) {
          usedSupabaseKeys.add(legacyKey);
        } else {
          // 3) Legacy cross-week match by name (reschedule that happened before
          //    this casting was re-keyed).
          const oldRecords = findProjectByName(project.project, trackingStatuses);
          if (oldRecords.length > 0) {
            saved = oldRecords[0].record;
            usedSupabaseKeys.add(oldRecords[0].key);
            logger.debug(`  🔄 Reschedule detected for "${project.project}": ${saved.weekMonday} → ${project.weekMonday}`);
          } else {
            logger.debug(`  ℹ️ No existing tracking status for "${project.project}" (new casting or first time)`);
          }
        }

        // We matched a legacy row but it isn't on the casting key yet. If we now
        // have structured numbers, schedule an in-place backfill so the row gains
        // the stable key (and refreshes to the current week).
        if (saved && castingKey && !pendingBackfills.has(castingKey)) {
          pendingBackfills.set(castingKey, {
            originalProject: saved.originalProject,
            oldWeekMonday: saved.weekMonday,
            newWeekMonday: project.weekMonday,
            projectNumber: project.projectNumber,
            castingNumber: project.castingNumber,
            projectName: project.project
          });
        }
      }

      // Generate unique ID. Includes the cast number when present — two castings
      // of one project can share a name AND a week, and this id is what state
      // lookups (getProjectById & co.) and DOM data-project-id keys use, so
      // name+week alone would make sibling castings collide.
      const castSuffix = project.castingNumber
        ? `_c${normalizeCastingNumber(project.castingNumber)}`
        : '';
      const id = `project_${project.project}_${project.weekMonday}${castSuffix}`.replace(/\s+/g, '_');

      // Authoritative name from the portal (looked up by project#), falling back
      // to the Sheet name when there's no project# or no portal match.
      const portalName = portalNameByNumber.get(normalizeNumberField(project.projectNumber));

      return {
        id,
        project: project.project,
        displayName: portalName || project.project,
        projectNumber: project.projectNumber || null,
        castingNumber: project.castingNumber || null,
        weekMonday: project.weekMonday,
        actualStartDate: project.actualStartDate,
        department: project.department,
        source: project.source,
        manualWeekId: saved && saved.manualWeekId ? saved.manualWeekId : null,
        trackingStatus: saved ? saved.trackingStatus : { ...DEFAULT_TRACKING_STATUS },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    // Add manual projects from Supabase that don't exist in Sheets
    trackingStatuses.forEach((record, key) => {
      // Skip if this record was already used for a Sheets casting
      if (usedSupabaseKeys.has(key)) {
        return;
      }

      // Only add if it's a manual project
      if (record.source === PROJECT_SOURCE.MANUAL) {
        // Same casting-aware id scheme as the Sheets branch above.
        const castSuffix = record.castingNumber
          ? `_c${normalizeCastingNumber(record.castingNumber)}`
          : '';
        const id = `project_${record.project}_${record.weekMonday}${castSuffix}`.replace(/\s+/g, '_');
        const portalName = portalNameByNumber.get(normalizeNumberField(record.projectNumber));

        projects.push({
          id,
          project: record.project,
          displayName: portalName || record.project,
          projectNumber: record.projectNumber || null,
          castingNumber: record.castingNumber || null,
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

    // Durably upgrade legacy rows onto the stable casting key — IN PLACE.
    // For each recognized-but-unstamped casting, UPDATE its existing row to set
    // project_number/casting_number (and refresh week_monday). The row keeps its
    // tracking_status, so milestone state is never lost and is never absent from
    // the DB (no delete-then-insert window). Future loads then exact-match on the
    // casting key and skip this path entirely (self-healing). This replaces the
    // old delete-then-resave reschedule migration.
    if (pendingBackfills.size > 0) {
      logger.debug(`🔑 Backfilling ${pendingBackfills.size} casting(s) onto stable project#+cast# key...`);

      for (const [castingKey, bf] of pendingBackfills) {
        try {
          await backfillCastingNumbers(bf);
          logger.debug(`  ✓ Stamped "${bf.projectName}" with ${castingKey} (week ${bf.newWeekMonday})`);
        } catch (error) {
          logger.error(`  ✗ Failed to backfill "${bf.projectName}" → ${castingKey}:`, error);
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
  logger.debug('📅 Loading manual weeks from Supabase...');

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

    logger.debug(`  → Loaded ${weeks.length} manual weeks`);
    return weeks;

  } catch (error) {
    logger.error('❌ Failed to load manual weeks:', error);
    // Throw rather than degrade: silently dropping the manual week dividers
    // made a failed reload indistinguishable from success. Failing the load
    // keeps the last good render and lets the auto-refresh engine retry.
    throw error;
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
 * Update manual week name in Supabase
 *
 * @param {string} weekId - ID of the manual week to update
 * @param {string} newName - New custom name for the week
 * @returns {Promise<Object>} The updated manual week object
 */
export async function updateManualWeekName(weekId, newName) {
  logger.debug(`📅 Updating manual week name: ${weekId} to "${newName}"`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Update the custom_name field
    const { data, error } = await client
      .from(MANUAL_WEEKS_TABLE)
      .update({ custom_name: newName })
      .eq('id', weekId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.debug(`  → Manual week name updated successfully`);

    // Send refresh signal to all other clients for silent sync
    await sendRefreshSignal({
      action: 'manual_week_name_updated',
      weekId: weekId,
      newName: newName
    });

    return {
      id: data.id,
      name: data.custom_name,
      position: data.position,
      createdAt: data.created_at
    };

  } catch (error) {
    logger.error(`❌ Failed to update manual week name:`, error);
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

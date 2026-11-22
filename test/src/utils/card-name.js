/**
 * The name the weekly card shows for a schedule entry (2026-11-10).
 *
 * The weekly groups tasks by `task.project`, the raw Optimizer sheet / scheduler text ("PopMart cast #1 1st build").
 * The card itself shows the portal project name with the cast number under it ("Pop Mart NY Flagship Facade",
 * "Cast 1") whenever the project number of the task matched a portal job. The search box and the Build Plan title
 * use this helper so they name a job exactly like its cards.
 * @module utils/card-name
 */

/**
 * @param {Array<Object>} tasks - every task of one `task.project`
 * @returns {{name: string, cast: string, description: string, sheetName: string, full: string}}
 *   name = the card title, cast = the cast number ('' when the card shows none), description = the description of
 *   the casting, sheetName = the raw schedule text, full = "name · Cast N"
 */
export function cardNameOf(tasks) {
    const list = tasks || [];
    const sheetName = String(list[0]?.project || '').trim();
    // A few sheet names carry more than one cast number: the pair most of its cards show wins.
    const counts = new Map();
    for (const t of list) {
        const name = String(t.resolvedProjectName || '').trim();
        if (!name) continue;
        const key = name + SEP + String(t.castingNumber || '').trim();
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = '', bestCount = 0;
    for (const [key, count] of counts) if (count > bestCount) { best = key; bestCount = count; }
    if (!best) return { name: sheetName, cast: '', description: '', sheetName, full: sheetName };
    const [name, cast] = best.split(SEP);
    const withDesc = list.find(t => String(t.resolvedProjectName || '').trim() === name
        && String(t.castingNumber || '').trim() === cast && t.castingDescription);
    const description = cast && withDesc ? String(withDesc.castingDescription).trim() : '';
    return { name, cast, description, sheetName, full: cast ? `${name} \u00b7 Cast ${cast}` : name };
}

const SEP = '\u0000';

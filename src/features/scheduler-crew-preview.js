/**
 * Plant Scheduler crew PREVIEW on the weekly (2026-10-23) — TEST SITE ONLY.
 *
 * Shows the crew assigned on the Plant Scheduler as a line on the weekly's task cards. It does
 * nothing unless `window.__SCHEDULER_CREW_PREVIEW` is set, which only the test site's guard script
 * does, so the live weekly is untouched. The scheduler does not feed the weekly: this only reads the
 * scheduler's days and matches them to the sheet's cards by job, casting, team and the day's index
 * in that team. When the sheet and the scheduler disagree on a day, the crew lands on the wrong card.
 *
 * @module features/scheduler-crew-preview
 */

import { initializeSupabase, getSupabaseClient } from '../services/supabase-service.js';
import { teamOfDepartment } from '../config/scheduler-config.js?v=20261023-2';

if (typeof window !== 'undefined' && window.__SCHEDULER_CREW_PREVIEW) {
    const index = new Map();            // project|cast|team|dayIdx -> names[]
    const pending = [];                 // cards built before the data arrived
    let ready = false;

    const style = document.createElement('style');
    style.textContent = `.task-card .crew-line { margin-top: 4px; font-size: 11px; font-weight: 700; color: #14532d; background: #dcfce7; border: 1px solid #86efac; border-radius: 6px; padding: 2px 6px; }
    .task-card .crew-line small { font-weight: 400; color: #166534; }`;
    document.head.appendChild(style);

    function decorate(card, task) {
        if (!card || !task || card.querySelector('.crew-line')) return;
        const team = teamOfDepartment(task.department);
        const key = `${String(task.projectNumber || '').trim()}|${String(task.castingNumber || '').trim()}|${team}|${String(task.castingDayNumber || task.dayNumber || '').trim()}`;
        const names = index.get(key);
        if (!names || !names.length) return;
        const div = document.createElement('div');
        div.className = 'crew-line';
        div.title = 'Crew from the Plant Scheduler (test preview)';
        div.textContent = `Crew: ${names.join(', ')}`;
        const sched = document.createElement('small');
        sched.textContent = ' (scheduler)';
        div.appendChild(sched);
        card.appendChild(div);
    }

    window.__crewDecorate = (card, task) => { if (ready) decorate(card, task); else pending.push([card, task]); };

    (async () => {
        try {
            await initializeSupabase();
            const client = getSupabaseClient();
            if (!client) return;
            const { data, error } = await client.from('plant_schedule').select('project_number, casting_id, date, department, crew').not('crew', 'is', null);
            if (error) { console.warn('[crew preview] scheduler days not readable (run migration/plant-schedule-crew.sql?)', error.message); return; }
            const ids = [...new Set((data || []).map(r => r.casting_id))];
            const castNum = new Map();
            for (let i = 0; i < ids.length; i += 80) {
                const { data: cs } = await client.from('project_castings').select('id, casting_number').in('id', ids.slice(i, i + 80));
                for (const c of cs || []) castNum.set(c.id, String(c.casting_number || '').trim());
            }
            // the day's index within its casting + team, by date — the same ordinal the sheet's cards carry
            const byGroup = new Map();
            for (const r of data || []) {
                const k = `${r.project_number}|${castNum.get(r.casting_id) || ''}|${r.department}`;
                if (!byGroup.has(k)) byGroup.set(k, new Set());
                byGroup.get(k).add(r.date);
            }
            for (const r of data || []) {
                if (!Array.isArray(r.crew) || !r.crew.length) continue;
                const k = `${r.project_number}|${castNum.get(r.casting_id) || ''}|${r.department}`;
                const dates = [...byGroup.get(k)].sort();
                const idx = dates.indexOf(r.date) + 1;
                const key = `${k}|${idx}`;
                index.set(key, [...new Set([...(index.get(key) || []), ...r.crew])]);
            }
        } catch (err) { console.warn('[crew preview] failed', err); }
        ready = true;
        for (const [card, task] of pending.splice(0)) decorate(card, task);
    })();
}

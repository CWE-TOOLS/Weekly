/**
 * Labor Popover
 *
 * Anchored popover that lists all actual_hours entries for a given day
 * or week, grouped by department. Cross-project view used from the
 * weekly grid date headers and the week-range pill.
 *
 * @module components/popovers/labor-popover
 */

import { loadActualHoursForRange } from '../../services/actual-hours-service.js';
import { logger } from '../../utils/logger.js';
import {
    DEPARTMENT_ORDER,
    DEPARTMENT_COLORS,
    normalizeDepartment,
    normalizeDepartmentClass
} from '../../config/department-config.js';

const POPOVER_ID = 'labor-popover';
let outsideHandler = null;
let escHandler = null;

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtHours(n) {
    return Number(n).toFixed(1);
}

function fmtDateShort(iso) {
    // 'YYYY-MM-DD' → 'Mon Jun 10'
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildContent(rows, isMultiDay) {
    if (!rows.length) {
        return '<div class="lp-empty">No actual hours logged.</div>';
    }

    const byDept = new Map();
    let grandTotal = 0;
    for (const row of rows) {
        const dept = row.department || '—';
        if (!byDept.has(dept)) byDept.set(dept, []);
        byDept.get(dept).push(row);
        grandTotal += Number(row.actual_hours) || 0;
    }

    // Sort departments in the same order they appear in the weekly schedule grid;
    // any unknown department falls to the end, alpha-sorted among themselves.
    const orderIndex = (dept) => {
        const idx = DEPARTMENT_ORDER.indexOf(normalizeDepartment(dept));
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    const depts = [...byDept.keys()].sort((a, b) => {
        const ai = orderIndex(a);
        const bi = orderIndex(b);
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
    });

    const sections = depts.map(dept => {
        const items = byDept.get(dept);
        const deptTotal = items.reduce((s, r) => s + (Number(r.actual_hours) || 0), 0);
        const sorted = items.slice().sort((a, b) => {
            const ad = String(a.task_date || '');
            const bd = String(b.task_date || '');
            if (ad !== bd) return ad.localeCompare(bd);
            return String(a.project_number || '').localeCompare(String(b.project_number || ''));
        });
        const rowsHtml = sorted.map(r => {
            const proj = r.project_number ? escapeHtml(r.project_number) : '—';
            const cast = r.casting_number ? `Cast ${escapeHtml(r.casting_number)}` : 'Non-casting';
            const day = r.day_number ? ` · Day ${escapeHtml(r.day_number)}` : '';
            const datePrefix = isMultiDay
                ? `<span class="lp-row-date">${escapeHtml(fmtDateShort(r.task_date))}</span> · `
                : '';
            return `<div class="lp-row">
                <span class="lp-row-meta">${datePrefix}${proj} · ${cast}${day}</span>
                <span class="lp-row-hours">${fmtHours(r.actual_hours)}</span>
            </div>`;
        }).join('');
        const colorKey = normalizeDepartmentClass(normalizeDepartment(dept));
        const color = DEPARTMENT_COLORS[colorKey];
        const headStyle = color ? ` style="background:${color.background};color:${color.text}"` : '';
        return `<div class="lp-section">
            <div class="lp-section-head"${headStyle}>
                <span class="lp-section-name">${escapeHtml(dept)}</span>
                <span class="lp-section-total">${fmtHours(deptTotal)}</span>
            </div>
            ${rowsHtml}
        </div>`;
    }).join('');

    return `<div class="lp-grand">
        <span class="lp-grand-label">Total</span>
        <span class="lp-grand-value">${fmtHours(grandTotal)} hrs</span>
    </div>
    ${sections}`;
}

function positionPopover(popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;

    let top = rect.bottom + gap;
    let left = rect.left + (rect.width / 2) - (popRect.width / 2);
    if (left < 8) left = 8;
    if (left + popRect.width > vw - 8) left = vw - popRect.width - 8;
    if (top + popRect.height > vh - 8) {
        top = rect.top - popRect.height - gap;
        if (top < 8) top = 8;
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

export function closeLaborPopover() {
    const existing = document.getElementById(POPOVER_ID);
    if (existing) existing.remove();
    if (outsideHandler) {
        document.removeEventListener('mousedown', outsideHandler, true);
        outsideHandler = null;
    }
    if (escHandler) {
        document.removeEventListener('keydown', escHandler, true);
        escHandler = null;
    }
}

/**
 * Open the labor popover anchored to a DOM element.
 * @param {HTMLElement} anchor — element to position against
 * @param {string} startDate  — ISO 'YYYY-MM-DD'
 * @param {string} endDate    — ISO 'YYYY-MM-DD' (same as startDate for a single day)
 * @param {string} title      — header text, e.g. "Wed Jun 10 — Actual Labor"
 */
export async function openLaborPopover(anchor, startDate, endDate, title) {
    closeLaborPopover();

    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.className = 'labor-popover';
    popover.innerHTML = `
        <div class="lp-header">
            <span class="lp-title">${escapeHtml(title)}</span>
            <button type="button" class="lp-close" aria-label="Close">×</button>
        </div>
        <div class="lp-body">
            <div class="lp-loading">Loading…</div>
        </div>
    `;
    document.body.appendChild(popover);

    popover.querySelector('.lp-close').addEventListener('click', closeLaborPopover);

    outsideHandler = (e) => {
        if (!popover.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
            closeLaborPopover();
        }
    };
    document.addEventListener('mousedown', outsideHandler, true);

    escHandler = (e) => {
        if (e.key === 'Escape') closeLaborPopover();
    };
    document.addEventListener('keydown', escHandler, true);

    positionPopover(popover, anchor);

    let rows = [];
    try {
        rows = await loadActualHoursForRange(startDate, endDate);
    } catch (err) {
        logger.error('[labor-popover] load failed:', err);
        const body = popover.querySelector('.lp-body');
        if (body) body.innerHTML = '<div class="lp-empty">Failed to load actual hours.</div>';
        return;
    }

    if (!document.body.contains(popover)) return; // closed mid-load

    const isMultiDay = startDate !== endDate;
    const body = popover.querySelector('.lp-body');
    if (body) body.innerHTML = buildContent(rows, isMultiDay);

    // Re-position after content swaps (height may have changed).
    positionPopover(popover, anchor);
}

/**
 * Number boxes and the mouse wheel (user 2026-11-03).
 *
 * Chrome changes the value of a FOCUSED <input type="number"> when the mouse wheel turns over it (8 -> 7 -> ... 0)
 * and fires an 'input' event for every step, while the page itself does not scroll. On the Optimizer Hours tab a PM
 * typed the hours for a day, rolled the wheel to move down the page with the pointer still over that box, and the
 * hours ran down to 0 and were saved that way - "the hours disappear after scrolling".
 *
 * Importing this module once per page installs the guard: when the wheel turns over the focused number box, the box
 * is left (blurred) BEFORE the browser applies its step, so the typed value stays and the page scrolls as expected.
 * Every other input keeps working as before; the arrow keys and the spin buttons still change the number.
 */
export function installNumberWheelGuard(doc = document) {
    if (!doc || doc.__numberWheelGuard) return;
    doc.__numberWheelGuard = true;
    doc.addEventListener('wheel', (e) => {
        const el = doc.activeElement;
        if (el && el.tagName === 'INPUT' && el.type === 'number' && el.contains(e.target)) el.blur();
    }, { capture: true, passive: true });
}

installNumberWheelGuard();

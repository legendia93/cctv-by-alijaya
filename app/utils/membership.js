// ============================================================================
// Membership helpers
// ----------------------------------------------------------------------------
// Central place for subscription-level logic so it stays consistent across
// login, the public dashboard gate, and the HLS stream authorization.
//
// See docs/06-audit-membership.md (celah C1/C2/C3) and docs/07-membership-fixes.md.
// ============================================================================

// Levels a given customer level is allowed to PLAY (watch), most-permissive first.
// Mirrors the hierarchy that was previously inlined in index.js "/" route.
const PLAYABLE_BY_LEVEL = {
    admin: null, // null = all levels
    vvip: ['umum', 'member', 'vip', 'vvip'],
    pemerintahan: ['umum', 'member', 'vip', 'pemerintahan'],
    vip: ['umum', 'member', 'vip'],
    member: ['umum', 'member'],
    umum: ['umum'],
};

// Levels that are "private/owned" — a customer only sees these if they own the
// camera (owner_id === customerId). Communal levels (umum/member/...) are shared.
// vvip was already owner-scoped in the original code; keep that behavior.
//
// C3: to run a per-customer SaaS model (each customer only sees their OWN
// cameras), set env CCTV_OWNER_SCOPED_LEVELS to a comma list, e.g.
//   CCTV_OWNER_SCOPED_LEVELS=vvip,vip,member
// See docs/07-membership-fixes.md.
// Per-user isolation model (see docs/07-membership-fixes.md, C3): every non-'umum'
// (paid) camera is private and only its owner may play it. 'umum' stays communal.
// This mirrors the tile visibility rule in the "/" route so a user can only play
// what they can see. Override the list via CCTV_OWNER_SCOPED_LEVELS if needed.
const OWNER_SCOPED_LEVELS = (process.env.CCTV_OWNER_SCOPED_LEVELS
    ? process.env.CCTV_OWNER_SCOPED_LEVELS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : ['vvip', 'pemerintahan', 'vip', 'member']);

/**
 * Is this membership currently active?
 * active_until is stored as 'YYYY-MM-DD' (see /admin/finance/approve).
 * A null/empty active_until means "no paid period" -> treated as expired
 * for paid levels (but 'umum' needs no subscription, see getEffectiveLevel).
 */
function isActive(activeUntil, now = new Date()) {
    if (!activeUntil) return false;
    const d = new Date(activeUntil);
    if (isNaN(d.getTime())) return false;
    // active_until is a date (inclusive through end of that day)
    const endOfDay = new Date(d.getTime());
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay >= now;
}

/**
 * Effective level = the level a user may actually use right now.
 * If the stored paid level has expired, drop to 'umum'. 'umum' and 'admin'
 * are never gated by active_until.
 *
 * @param {{level?:string, active_until?:string}} user
 * @returns {string} effective level (lowercase)
 */
function getEffectiveLevel(user, now = new Date()) {
    const level = String(user?.level || 'umum').toLowerCase();
    if (level === 'umum' || level === 'admin') return level;
    return isActive(user?.active_until, now) ? level : 'umum';
}

/**
 * Levels this (effective) level may play.
 * @returns {string[]|null} null means "all" (admin).
 */
function playableLevelsFor(effectiveLevel) {
    const lvl = String(effectiveLevel || 'umum').toLowerCase();
    if (lvl === 'admin') return null;
    return PLAYABLE_BY_LEVEL[lvl] || PLAYABLE_BY_LEVEL.umum;
}

/**
 * Can a requester play a specific camera?
 * @param {object} ctx
 * @param {boolean} ctx.isAdmin      - admin session present
 * @param {string}  ctx.effectiveLevel - customer effective level (if any)
 * @param {number|null} ctx.customerId
 * @param {object}  camera - { level, owner_id }
 * @returns {boolean}
 */
function canPlayCamera(ctx, camera) {
    if (ctx.isAdmin) return true;
    const camLevel = String(camera?.level || 'umum').toLowerCase();
    const playable = playableLevelsFor(ctx.effectiveLevel);
    if (playable !== null && !playable.includes(camLevel)) return false;

    // Owner-scoped levels require ownership match.
    if (OWNER_SCOPED_LEVELS.includes(camLevel)) {
        if (camera?.owner_id == null) return false;
        return String(camera.owner_id) === String(ctx.customerId);
    }
    return true;
}

module.exports = {
    PLAYABLE_BY_LEVEL,
    OWNER_SCOPED_LEVELS,
    isActive,
    getEffectiveLevel,
    playableLevelsFor,
    canPlayCamera,
};

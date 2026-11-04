/**
 * Filter for TenantModule reads: a module a store bought monthly counts only until its end date. Rows with no end date (a plan's own, a staff
 * grant, a one-time purchase) always count. Every read that decides whether a module is on goes through this, so an expired month switches
 * the module off everywhere at once, with nothing to sweep.
 */
export const notExpired = (now: Date = new Date()) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

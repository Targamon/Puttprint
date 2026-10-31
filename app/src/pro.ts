export type Plan = 'free' | 'trial' | 'pro' | 'lifetime'
export interface ProStatus { plan: Plan; trialEnds?: number; expires?: number; trialUsed?: boolean }
const KEY = 'pp.pro'
const DAY = 86400000
export function loadPro(): ProStatus { try { return JSON.parse(localStorage.getItem(KEY) || '') } catch { return { plan: 'free' } } }
export const savePro = (p: ProStatus) => localStorage.setItem(KEY, JSON.stringify(p))
export function isPro(p = loadPro()): boolean {
  const now = Date.now()
  if (p.plan === 'lifetime') return true
  if (p.plan === 'trial') return (p.trialEnds ?? 0) > now
  if (p.plan === 'pro') return (p.expires ?? 0) > now
  return false
}
/** Mock purchase — unlocks on this device only (no StoreKit / Play Billing yet). */
export function mockBuy(kind: 'monthly' | 'yearly' | 'lifetime' | 'trial'): ProStatus {
  const now = Date.now(), cur = loadPro()
  const p: ProStatus = kind === 'lifetime' ? { plan: 'lifetime', trialUsed: cur.trialUsed }
    : kind === 'trial' ? { plan: 'trial', trialEnds: now + 7 * DAY, trialUsed: true }
    : { plan: 'pro', expires: now + (kind === 'yearly' ? 365 : 30) * DAY, trialUsed: cur.trialUsed }
  savePro(p); return p
}
export const userAddedCount = () => { try { return (JSON.parse(localStorage.getItem('pp.courses') || '[]') as unknown[]).length } catch { return 0 } }

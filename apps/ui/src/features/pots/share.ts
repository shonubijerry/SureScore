import type { PotCard } from '../../lib/types'

/** The pot link to share; a private pot's link carries its share code, which is what grants access. */
export function potShareUrl(pot: Pick<PotCard, 'id' | 'isPrivate' | 'shareCode'>): string | null {
  if (!pot.shareCode) return null // not funded yet
  const url = new URL(`/pots/${pot.id}`, window.location.origin)
  if (pot.isPrivate) url.searchParams.set('code', pot.shareCode)
  return url.toString()
}

// Native GPS via @capacitor/geolocation when running inside the iOS/Android shell; undefined => use browser geolocation.
import { Capacitor } from '@capacitor/core'
import type { LL } from './types'
export async function nativePos(): Promise<LL | null | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined
  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
    return [p.coords.longitude, p.coords.latitude]
  } catch { return null }
}

export interface GeoPoint {
  lat: number
  lng: number
  accuracy: number
}

export function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('این دستگاه از موقعیت‌یابی پشتیبانی نمی‌کند'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'دسترسی به موقعیت مکانی رد شد. از تنظیمات مرورگر اجازه دهید.'
            : err.code === err.TIMEOUT
              ? 'دریافت موقعیت زمان‌بر شد. دوباره تلاش کنید.'
              : 'موقعیت در دسترس نیست.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function fmtCoord(n?: number): string {
  return n === undefined ? '' : n.toFixed(6)
}

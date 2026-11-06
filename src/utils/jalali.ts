/** تبدیل تاریخ شمسی ↔ میلادی (الگوریتم jalaali) */

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
const div = (a: number, b: number) => Math.trunc(a / b)
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b

function jalCal(jy: number) {
  const bl = BREAKS.length
  const gy = jy + 621
  let leapJ = -14
  let jp = BREAKS[0]
  let jm = 0
  let jump = 0
  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال خارج از محدوده')
  for (let i = 1; i < bl; i++) {
    jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

export interface JDate {
  jy: number
  jm: number
  jd: number
}

export function toJalaliParts(gy: number, gm: number, gd: number): JDate {
  return d2j(g2d(gy, gm, gd))
}

export function toGregorianParts(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd))
}

export function isLeapJalali(jy: number): boolean {
  return jalCal(jy).leap === 0
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalali(jy) ? 30 : 29
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

/** ISO (YYYY-MM-DD) → اجزای شمسی */
export function isoToJalali(iso: string): JDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return toJalaliParts(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** اجزای شمسی → ISO (YYYY-MM-DD) */
export function jalaliToISO(jy: number, jm: number, jd: number): string {
  const g = toGregorianParts(jy, jm, jd)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

/** نمایش 1404/08/15 */
export function formatJalali(iso?: string | null): string {
  if (!iso) return ''
  const j = isoToJalali(iso)
  if (!j) return ''
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
}

const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** تجزیه ورودی کاربر مثل 1404/8/15 یا ۱۴۰۴-۰۸-۱۵ یا 14040815 → ISO؛ در صورت نامعتبر null */
export function parseJalaliInput(text: string): string | null {
  const t = toLatinDigits(text).trim()
  let m = /^(\d{4})[/\-. ](\d{1,2})[/\-. ](\d{1,2})$/.exec(t)
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
  if (!m) {
    // سال دو رقمی: 04/08/15
    const m2 = /^(\d{2})[/\-. ](\d{1,2})[/\-. ](\d{1,2})$/.exec(t)
    if (m2) m = [m2[0], String(1400 + Number(m2[1])), m2[2], m2[3]] as unknown as RegExpExecArray
  }
  if (!m) return null
  const jy = Number(m[1])
  const jm = Number(m[2])
  const jd = Number(m[3])
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthLength(jy, jm)) return null
  return jalaliToISO(jy, jm, jd)
}

/** روز هفته (۰ = شنبه) برای یک تاریخ ISO */
export function jalaliWeekday(iso: string): number {
  const d = new Date(iso + 'T12:00:00')
  return (d.getDay() + 1) % 7
}

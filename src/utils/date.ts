const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const faDateLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const faDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function parse(value?: string | number | Date | null): Date | null {
  if (value === undefined || value === null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** تاریخ شمسی کوتاه مثل 1403/08/16 */
export function toJalali(value?: string | number | Date | null): string {
  const d = parse(value)
  return d ? faDate.format(d) : '—'
}

/** تاریخ شمسی بلند مثل «چهارشنبه ۱۶ آبان ۱۴۰۳» */
export function toJalaliLong(value?: string | number | Date | null): string {
  const d = parse(value)
  return d ? faDateLong.format(d) : '—'
}

export function toJalaliDateTime(value?: string | number | Date | null): string {
  const d = parse(value)
  return d ? faDateTime.format(d) : '—'
}

/** تاریخ امروز به صورت YYYY-MM-DD (به وقت محلی) برای input[type=date] */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** مقدار پیش‌فرض برای input[type=datetime-local] */
export function nowLocalISO(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISODate(d)
}

/** اختلاف روز بین امروز و تاریخ داده شده (منفی یعنی گذشته) */
export function daysUntil(iso?: string | null): number | null {
  const d = parse(iso)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function isPast(iso?: string | null): boolean {
  const n = daysUntil(iso)
  return n !== null && n < 0
}

export function relativeDays(iso?: string | null): string {
  const n = daysUntil(iso)
  if (n === null) return ''
  if (n === 0) return 'امروز'
  if (n === 1) return 'فردا'
  if (n === -1) return 'دیروز'
  if (n < 0) return `${Math.abs(n)} روز گذشته`
  return `${n} روز مانده`
}

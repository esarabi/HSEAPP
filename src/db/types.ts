// مدل‌های داده برنامه. همه تاریخ‌ها به صورت ISO (YYYY-MM-DD) میلادی ذخیره می‌شوند
// و در رابط کاربری به شمسی نمایش داده می‌شوند.

export type ID = string

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type ActionStatus = 'open' | 'in_progress' | 'done'

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'کم',
  medium: 'متوسط',
  high: 'زیاد',
  critical: 'بحرانی',
}

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: 'باز',
  in_progress: 'در حال انجام',
  done: 'انجام شده',
}

// ---------- بازرسی و چک‌لیست ----------
export type CheckResult = 'ok' | 'nok' | 'na' | ''

export interface ChecklistItem {
  id: ID
  text: string
  result: CheckResult
  note?: string
}

export interface Inspection {
  id: ID
  date: string
  templateId: string
  templateName: string
  location: string
  inspector: string
  items: ChecklistItem[]
  notes?: string
  createdAt: number
}

// ---------- گزارش شرایط ناایمن ----------
export interface Finding {
  id: ID
  date: string
  location: string
  description: string
  severity: Severity
  correctiveAction?: string
  responsible?: string
  dueDate?: string
  status: ActionStatus
  inspectionId?: ID
  photoId?: ID
  createdAt: number
}

// ---------- حوادث ----------
export type IncidentType =
  | 'injury'
  | 'near_miss'
  | 'property_damage'
  | 'fire'
  | 'environmental'
  | 'occupational_illness'

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  injury: 'حادثه منجر به جراحت',
  near_miss: 'شبه‌حادثه',
  property_damage: 'خسارت به اموال',
  fire: 'آتش‌سوزی',
  environmental: 'آلودگی محیط‌زیستی',
  occupational_illness: 'بیماری شغلی',
}

export interface Incident {
  id: ID
  date: string
  time?: string
  type: IncidentType
  location: string
  title: string
  description: string
  personsInvolved?: string
  severity: Severity
  lostDays?: number
  rootCause?: string
  correctiveAction?: string
  responsible?: string
  dueDate?: string
  status: ActionStatus
  photoId?: ID
  createdAt: number
}

// ---------- مجوز کار ----------
export type PermitType =
  | 'hot_work'
  | 'cold_work'
  | 'height'
  | 'confined_space'
  | 'excavation'
  | 'electrical'
  | 'lifting'

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
  hot_work: 'کار گرم',
  cold_work: 'کار سرد',
  height: 'کار در ارتفاع',
  confined_space: 'فضای بسته',
  excavation: 'حفاری',
  electrical: 'کار برقی',
  lifting: 'عملیات بالابری',
}

export type PermitStatus = 'active' | 'closed' | 'cancelled'

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  active: 'فعال',
  closed: 'بسته شده',
  cancelled: 'لغو شده',
}

export interface Permit {
  id: ID
  number: string
  type: PermitType
  location: string
  description: string
  contractor: string
  supervisor: string
  issuer: string
  startAt: string // ISO datetime-local
  endAt: string
  precautions: { id: ID; text: string; done: boolean }[]
  status: PermitStatus
  closedAt?: number
  createdAt: number
}

// ---------- پرسنل و آموزش ----------
export interface Person {
  id: ID
  name: string
  personnelCode?: string
  unit?: string
  jobTitle?: string
  phone?: string
  medicalExamDate?: string
  medicalExamExpiry?: string
  createdAt: number
}

export interface Training {
  id: ID
  personId: ID
  course: string
  date: string
  expiryDate?: string
  hours?: number
  instructor?: string
  certificateNo?: string
  createdAt: number
}

// ---------- وظایف ----------
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'بدون تکرار',
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  quarterly: 'سه‌ماهه',
  yearly: 'سالانه',
}

export type TaskCategory = 'inspection' | 'training' | 'meeting' | 'report' | 'equipment' | 'other'

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  inspection: 'بازرسی',
  training: 'آموزش',
  meeting: 'جلسه',
  report: 'گزارش',
  equipment: 'تجهیزات',
  other: 'سایر',
}

export interface Task {
  id: ID
  title: string
  category: TaskCategory
  dueDate: string
  recurrence: Recurrence
  notes?: string
  done: boolean
  doneAt?: number
  createdAt: number
}

// ---------- پیوست ----------
export interface Photo {
  id: ID
  blob: Blob
  type: string
  createdAt: number
}

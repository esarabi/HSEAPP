import { BUILTIN_CATALOGS } from '../data/catalogs'
import { db, newId } from './db'
import type { NonConformance } from './types'

/**
 * حوزه‌ها و کاتالوگ‌های داخلی را در صورت نبود، وارد پایگاه داده می‌کند.
 * شناسه‌های ثابت باعث می‌شود اجرای مجدد تکراری نسازد.
 */
export async function ensureBuiltinData() {
  const now = Date.now()
  for (const cat of BUILTIN_CATALOGS) {
    const domainId = `builtin:${cat.id}`
    const existing = await db.domains.get(domainId)
    if (!existing) await db.domains.put({ id: domainId, name: cat.name, createdAt: now })
    const count = await db.nonConformances.where('domainId').equals(domainId).count()
    if (count === 0) {
      const rows: NonConformance[] = cat.items.map((it, i) => ({
        id: `${domainId}:${it.code}`,
        domainId,
        code: it.code,
        title: it.title,
        questionType: it.questionType || undefined,
        process: it.process || undefined,
        ncDescription: it.ncDescription || undefined,
        legalBasis: it.legalBasis || undefined,
        correctiveAction: it.correctiveAction || undefined,
        score: it.score ?? undefined,
        criticality: it.criticality || undefined,
        deadline: it.deadline || undefined,
        custom: false,
        createdAt: now + i,
      }))
      await db.nonConformances.bulkPut(rows)
    }
  }
  // حوزه خدمات شهری به‌عنوان نمونه خالی
  const urban = await db.domains.where('name').equals('خدمات شهری').first()
  if (!urban) await db.domains.put({ id: newId(), name: 'خدمات شهری', createdAt: now + 1000 })
}

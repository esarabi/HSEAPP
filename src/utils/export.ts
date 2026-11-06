import { db, TABLE_NAMES, type TableName } from '../db/db'

const BACKUP_VERSION = 1

export interface Backup {
  app: 'hseapp'
  version: number
  exportedAt: string
  tables: Record<TableName, unknown[]>
  photos: { id: string; type: string; createdAt: number; dataUrl: string }[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function exportBackup(): Promise<Backup> {
  const tables = {} as Record<TableName, unknown[]>
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray()
  }
  const photos = await db.photos.toArray()
  const encoded = []
  for (const p of photos) {
    encoded.push({ id: p.id, type: p.type, createdAt: p.createdAt, dataUrl: await blobToDataUrl(p.blob) })
  }
  return { app: 'hseapp', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables, photos: encoded }
}

export async function importBackup(data: unknown, mode: 'merge' | 'replace'): Promise<number> {
  const b = data as Partial<Backup>
  if (!b || b.app !== 'hseapp' || !b.tables) throw new Error('فایل پشتیبان معتبر نیست')
  let count = 0
  await db.transaction('rw', [...TABLE_NAMES.map((n) => db.table(n)), db.photos], async () => {
    if (mode === 'replace') {
      for (const name of TABLE_NAMES) await db.table(name).clear()
      await db.photos.clear()
    }
    for (const name of TABLE_NAMES) {
      const rows = b.tables?.[name]
      if (Array.isArray(rows) && rows.length) {
        await db.table(name).bulkPut(rows)
        count += rows.length
      }
    }
    // پشتیبان‌های قدیمی: «بازدید»ها به بازرسی تبدیل می‌شوند
    const legacy = (b.tables as Record<string, unknown[]> | undefined)?.visits
    if (Array.isArray(legacy) && legacy.length) {
      for (const v of legacy as Record<string, unknown>[]) {
        const { items, ...rest } = v
        await db.inspections.put({ ...rest, items: [], ncItems: items ?? [] } as never)
      }
      count += legacy.length
    }
  })
  // عکس‌ها خارج از تراکنش، چون تبدیل dataURL ناهمگام است
  for (const p of b.photos ?? []) {
    const blob = await dataUrlToBlob(p.dataUrl)
    await db.photos.put({ id: p.id, type: p.type, createdAt: p.createdAt, blob })
  }
  return count
}

export function downloadFile(filename: string, content: Blob | string, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** خروجی CSV با BOM تا در Excel فارسی درست باز شود */
export function toCSV(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const esc = (v: string | number | undefined | null) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))]
  return '﻿' + lines.join('\r\n')
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  downloadFile(filename, toCSV(headers, rows), 'text/csv;charset=utf-8')
}

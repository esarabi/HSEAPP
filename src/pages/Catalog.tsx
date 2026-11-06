import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { db, newId } from '../db/db'
import type { NonConformance } from '../db/types'
import { CRITICALITY_LEVELS, criticalityTone } from '../db/types'
import { normalize, readSpreadsheet, type Row } from '../utils/sheet'
import { downloadCSV } from '../utils/export'
import { todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, Modal, PageHead, toast } from '../components/ui'
import { IconPlus, IconTrash, IconUpload } from '../components/Icons'
import { NcFormModal } from '../components/NcPicker'

export function CatalogPage() {
  const domains = useLiveQuery(() => db.domains.orderBy('createdAt').toArray(), [])
  const [domainId, setDomainId] = useState('')
  const activeDomain = domainId || domains?.[0]?.id || ''
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<NonConformance | null | 'new'>(null)
  const [del, setDel] = useState<NonConformance | null>(null)
  const [importing, setImporting] = useState<Row[] | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [domainModal, setDomainModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const items = useLiveQuery(() => (activeDomain ? db.nonConformances.where('domainId').equals(activeDomain).sortBy('code') : []), [activeDomain])
  const filtered = useMemo(() => {
    const nq = normalize(q)
    if (!nq) return items ?? []
    return (items ?? []).filter((c) => normalize(c.code).includes(nq) || normalize(c.title).includes(nq) || normalize(c.process ?? '').includes(nq))
  }, [items, q])

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const rows = await readSpreadsheet(f)
      if (rows.length < 2) throw new Error('فایل داده‌ای ندارد')
      setImporting(rows)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'خواندن فایل ناموفق بود')
    }
  }
  function exportCsv() {
    if (!items?.length) return
    const dn = domains?.find((d) => d.id === activeDomain)?.name ?? 'catalog'
    downloadCSV(
      `nc-${dn}-${todayISO()}.csv`,
      ['شناسه', 'نوع سؤال', 'فرآیند / محل', 'عنوان', 'شرح عدم انطباق', 'الزام قانونی', 'اقدام کنترلی اصلاحی', 'امتیاز', 'درجه بحرانیت', 'مهلت رفع عدم انطباق'],
      items.map((c) => [c.code, c.questionType, c.process, c.title, c.ncDescription, c.legalBasis, c.correctiveAction, c.score, c.criticality, c.deadline]),
    )
  }
  async function addDomain() {
    const name = newDomain.trim()
    if (!name) return
    const id = newId()
    await db.domains.add({ id, name, createdAt: Date.now() })
    setDomainId(id)
    setNewDomain('')
    setDomainModal(false)
  }

  return (
    <div>
      <PageHead
        title="کاتالوگ عدم انطباق"
        sub="شناسه‌های عدم انطباق هر حوزه"
        back="/contracts"
        actions={
          <>
            <button className="btn sm" onClick={() => fileRef.current?.click()}><IconUpload /> ورود از Excel/CSV</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={pickFile} />
            <button className="btn sm" onClick={exportCsv} disabled={!items?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => setEditing('new')} disabled={!activeDomain}><IconPlus /> مورد جدید</button>
          </>
        }
      />
      <div className="toolbar">
        <select className="input" value={activeDomain} onChange={(e) => setDomainId(e.target.value)}>
          {domains?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn sm" onClick={() => setDomainModal(true)}>+ حوزه</button>
        <input className="input" placeholder="جستجو با شناسه، عنوان یا فرآیند…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>{items?.length ?? 0} مورد در این حوزه{q && ` · ${filtered.length} مورد مطابق جستجو`}</p>
      {items && items.length === 0 && (
        <Empty text="این حوزه هنوز موردی ندارد. فایل اکسل چک‌لیست را وارد کنید یا دستی اضافه کنید." />
      )}
      <div className="card nc-list" style={{ maxHeight: 'none' }}>
        {filtered.map((c) => (
          <div key={c.id} className="nc-row">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div className="title"><code className="code">{c.code}</code> {c.title}</div>
                <div className="meta">
                  {c.criticality && <Badge tone={criticalityTone(c.score)}>{c.criticality}</Badge>}
                  {c.questionType && <span>{c.questionType}</span>}
                  {c.process && <span>{c.process}</span>}
                  {c.deadline && <span>مهلت: {c.deadline}</span>}
                  {c.custom && <Badge>افزوده کارشناس</Badge>}
                </div>
              </div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <button className="btn ghost sm" onClick={() => setEditing(c)}>ویرایش</button>
                <button className="btn ghost sm" onClick={() => setDel(c)}><IconTrash /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeDomain && editing && (
        <NcFormModal open domainId={activeDomain} existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      <Confirm open={!!del} text={`مورد «${del?.code}» از کاتالوگ حذف شود؟ بازدیدهای قبلی که به آن اشاره دارند تغییر نمی‌کنند.`} onCancel={() => setDel(null)} onConfirm={async () => { await db.nonConformances.delete(del!.id); setDel(null) }} />
      <Modal open={domainModal} title="حوزه جدید" onClose={() => setDomainModal(false)}>
        <div className="stack">
          <Field label="نام حوزه" required><input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="مثلاً خدمات شهری" /></Field>
          <div className="form-actions">
            <button className="btn primary" disabled={!newDomain.trim()} onClick={addDomain}>افزودن</button>
            <button className="btn" onClick={() => setDomainModal(false)}>انصراف</button>
          </div>
        </div>
      </Modal>
      {importing && activeDomain && <ImportModal rows={importing} domainId={activeDomain} onClose={() => setImporting(null)} />}
    </div>
  )
}

// ---------- ورود از فایل ----------

type FieldKey = 'code' | 'title' | 'questionType' | 'process' | 'ncDescription' | 'legalBasis' | 'correctiveAction' | 'score' | 'criticality' | 'deadline'
const FIELD_LABELS: Record<FieldKey, string> = {
  code: 'شناسه',
  title: 'عنوان',
  questionType: 'نوع سؤال',
  process: 'فرآیند / محل',
  ncDescription: 'شرح عدم انطباق',
  legalBasis: 'الزام قانونی',
  correctiveAction: 'اقدام کنترلی اصلاحی',
  score: 'امتیاز / ضریب',
  criticality: 'درجه بحرانیت',
  deadline: 'مهلت رفع',
}
const FIELD_EXACT: Record<FieldKey, string[]> = {
  code: ['شناسه', 'کد', 'code', 'id'],
  title: ['عنوان', 'عنوان عدم انطباق', 'سوال', 'سؤال', 'title'],
  questionType: ['نوع سوال', 'نوع سؤال', 'نوع'],
  process: ['فرآیند / محل', 'فرایند / محل', 'فرآیند', 'محل'],
  ncDescription: ['شرح عدم انطباق', 'شرح'],
  legalBasis: ['الزام قانونی'],
  correctiveAction: ['اقدام کنترلی اصلاحی', 'اقدام اصلاحی'],
  score: ['امتیاز', 'ضریب', 'ضریب بحرانیت'],
  criticality: ['درجه بحرانیت', 'بحران', 'اهمیت'],
  deadline: ['مهلت رفع عدم انطباق', 'مهلت رفع', 'مهلت'],
}
const FIELD_PATTERNS: Record<FieldKey, RegExp> = {
  code: /^شناسه|^کد$|^code$|^id$/i,
  title: /^عنوان|سوال|سؤال|title|question/i,
  questionType: /نوع/,
  process: /فرآیند|فرایند|محل|process/i,
  ncDescription: /شرح عدم|شرح|description/i,
  legalBasis: /الزام|قانون|legal/i,
  correctiveAction: /اقدام|action/i,
  score: /امتیاز|ضریب|score|weight/i,
  criticality: /درجه|بحرانیت|اهمیت|critical/i,
  deadline: /مهلت|deadline/i,
}

function findHeaderRow(rows: Row[]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map(normalize)
    if (cells.some((c) => FIELD_PATTERNS.code.test(c)) && cells.some((c) => FIELD_PATTERNS.title.test(c))) return i
  }
  return 0
}

function ImportModal({ rows, domainId, onClose }: { rows: Row[]; domainId: string; onClose: () => void }) {
  const headerRow = useMemo(() => findHeaderRow(rows), [rows])
  const headers = rows[headerRow].map((h) => normalize(h))
  const [mapping, setMapping] = useState<Record<FieldKey, number>>(() => {
    const m = {} as Record<FieldKey, number>
    const used = new Set<number>()
    const keys = Object.keys(FIELD_PATTERNS) as FieldKey[]
    for (const key of keys) m[key] = -1
    // ابتدا تطابق دقیق نام ستون، سپس الگوی تقریبی
    for (const key of keys) {
      const idx = headers.findIndex((h, i) => h && !used.has(i) && FIELD_EXACT[key].some((n) => normalize(n) === h))
      if (idx >= 0) { m[key] = idx; used.add(idx) }
    }
    for (const key of keys) {
      if (m[key] >= 0) continue
      const idx = headers.findIndex((h, i) => h && !used.has(i) && FIELD_PATTERNS[key].test(h))
      if (idx >= 0) { m[key] = idx; used.add(idx) }
    }
    return m
  })
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const data = rows.slice(headerRow + 1)
  const get = (r: Row, k: FieldKey) => (mapping[k] >= 0 ? normalize(r[mapping[k]] ?? '') : '')
  const valid = data.filter((r) => get(r, 'code') && get(r, 'title'))

  async function run() {
    setBusy(true)
    try {
      const now = Date.now()
      const existing = await db.nonConformances.where('domainId').equals(domainId).toArray()
      const byCode = new Map(existing.map((e) => [e.code, e]))
      const items: NonConformance[] = valid.map((r, i) => {
        const code = get(r, 'code')
        const scoreRaw = get(r, 'score').replace(/[^\d.]/g, '')
        let score = scoreRaw ? Math.round(Number(scoreRaw)) : undefined
        let criticality = get(r, 'criticality') || undefined
        if (!score && criticality) score = CRITICALITY_LEVELS.find((l) => criticality!.includes(l.label.replace('اهمیت ', '')))?.score
        if (score && !criticality) criticality = CRITICALITY_LEVELS.find((l) => l.score === score)?.label
        const old = byCode.get(code)
        return {
          id: old?.id ?? newId(),
          domainId,
          code,
          title: get(r, 'title'),
          questionType: get(r, 'questionType') || undefined,
          process: get(r, 'process') || undefined,
          ncDescription: get(r, 'ncDescription') || undefined,
          legalBasis: get(r, 'legalBasis') || undefined,
          correctiveAction: get(r, 'correctiveAction') || undefined,
          score,
          criticality,
          deadline: get(r, 'deadline') || undefined,
          custom: false,
          createdAt: old?.createdAt ?? now + i,
        }
      })
      await db.transaction('rw', db.nonConformances, async () => {
        if (mode === 'replace') await db.nonConformances.where('domainId').equals(domainId).delete()
        await db.nonConformances.bulkPut(items)
      })
      toast(`${items.length} مورد وارد شد`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="ورود کاتالوگ از فایل" onClose={onClose}>
      <div className="stack">
        <p className="text-sm text-muted">سطر عنوان: ردیف {headerRow + 1} · {valid.length} ردیف دارای شناسه و عنوان از {data.length} ردیف</p>
        <div className="grid-2">
          {(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => (
            <Field key={k} label={FIELD_LABELS[k]} required={k === 'code' || k === 'title'}>
              <select value={mapping[k]} onChange={(e) => setMapping({ ...mapping, [k]: Number(e.target.value) })}>
                <option value={-1}>— نادیده —</option>
                {headers.map((h, i) => h && <option key={i} value={i}>{h}</option>)}
              </select>
            </Field>
          ))}
        </div>
        {valid[0] && (
          <div className="card text-sm" style={{ background: 'var(--surface-2)' }}>
            <strong>پیش‌نمایش ردیف اول:</strong>
            <div><code className="code">{get(valid[0], 'code')}</code> {get(valid[0], 'title')}</div>
            <div className="meta"><span>{get(valid[0], 'criticality')}</span><span>{get(valid[0], 'process')}</span></div>
          </div>
        )}
        <Field label="روش ورود">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
            <option value="merge">ادغام (به‌روزرسانی شناسه‌های موجود، افزودن جدیدها)</option>
            <option value="replace">جایگزینی کامل کاتالوگ این حوزه</option>
          </select>
        </Field>
        <div className="form-actions">
          <button className="btn primary" disabled={busy || valid.length === 0 || mapping.code < 0 || mapping.title < 0} onClick={run}>ورود {valid.length} مورد</button>
          <button className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </Modal>
  )
}

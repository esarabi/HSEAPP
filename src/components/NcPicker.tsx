import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, newId } from '../db/db'
import type { NonConformance, VisitItem } from '../db/types'
import { CRITICALITY_LEVELS, criticalityTone } from '../db/types'
import { normalize } from '../utils/sheet'
import { Badge, Field, Modal, toast } from './ui'

/**
 * انتخاب موارد عدم انطباق از کاتالوگ یک حوزه با جستجو بر اساس شناسه یا عنوان،
 * انتخاب چندتایی و افزودن مورد جدید در لحظه.
 */
export function NcPicker({ domainId, value, onChange }: { domainId?: string; value: VisitItem[]; onChange: (items: VisitItem[]) => void }) {
  const [q, setQ] = useState('')
  const [process, setProcess] = useState('')
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const catalog = useLiveQuery(() => (domainId ? db.nonConformances.where('domainId').equals(domainId).sortBy('code') : []), [domainId])
  const selected = useMemo(() => new Map(value.map((v) => [v.ncId, v])), [value])
  const processes = useMemo(() => Array.from(new Set((catalog ?? []).map((c) => c.process).filter(Boolean))) as string[], [catalog])

  const filtered = useMemo(() => {
    if (!catalog) return []
    const nq = normalize(q)
    let rows = catalog
    if (process) rows = rows.filter((c) => c.process === process)
    if (nq) {
      rows = rows.filter((c) => normalize(c.code).includes(nq) || normalize(c.title).includes(nq) || normalize(c.ncDescription ?? '').includes(nq))
    }
    return rows.slice(0, 60)
  }, [catalog, q, process])

  function toggle(nc: NonConformance) {
    if (selected.has(nc.id)) onChange(value.filter((v) => v.ncId !== nc.id))
    else onChange([...value, { ncId: nc.id }])
  }
  function setNote(ncId: string, note: string) {
    onChange(value.map((v) => (v.ncId === ncId ? { ...v, note } : v)))
  }

  if (!domainId) return <p className="hint">ابتدا پیمان را انتخاب کنید تا کاتالوگ عدم انطباق حوزه آن نمایش داده شود.</p>

  const selectedRows = value.map((v) => ({ v, nc: catalog?.find((c) => c.id === v.ncId) })).filter((x) => x.nc) as { v: VisitItem; nc: NonConformance }[]

  return (
    <div className="stack">
      {selectedRows.length > 0 && (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <strong className="text-sm">موارد انتخاب‌شده ({selectedRows.length})</strong>
          {selectedRows.map(({ v, nc }) => (
            <div key={nc.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="body">
                <div className="title"><code className="code">{nc.code}</code> {nc.title}</div>
                <div className="meta">
                  {nc.criticality && <Badge tone={criticalityTone(nc.score)}>{nc.criticality}</Badge>}
                  {nc.deadline && <span>مهلت: {nc.deadline}</span>}
                </div>
                <input className="input mt" style={{ minHeight: 36 }} placeholder="توضیح / محل دقیق (اختیاری)" value={v.note ?? ''} onChange={(e) => setNote(nc.id, e.target.value)} />
              </div>
              <button type="button" className="btn ghost sm" onClick={() => toggle(nc)} aria-label="حذف از انتخاب">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <input className="input" placeholder="جستجو با شناسه یا عنوان…" value={q} onChange={(e) => setQ(e.target.value)} />
        {processes.length > 0 && (
          <select className="input" value={process} onChange={(e) => setProcess(e.target.value)}>
            <option value="">همه فرآیندها</option>
            {processes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <button type="button" className="btn sm" onClick={() => setAdding(true)}>+ مورد جدید</button>
      </div>

      <div className="card nc-list">
        {catalog && catalog.length === 0 && <p className="text-muted text-sm">کاتالوگ این حوزه خالی است. مورد جدید اضافه کنید یا از صفحه «عدم انطباق‌ها» فایل وارد کنید.</p>}
        {catalog && catalog.length > 0 && filtered.length === 0 && <p className="text-muted text-sm">موردی مطابق جستجو پیدا نشد. می‌توانید آن را به‌عنوان مورد جدید اضافه کنید.</p>}
        {filtered.map((nc) => {
          const on = selected.has(nc.id)
          const open = expanded === nc.id
          return (
            <div key={nc.id} className={`nc-row ${on ? 'on' : ''}`}>
              <label className="check" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(nc)} />
                <span className="body">
                  <span className="title"><code className="code">{nc.code}</code> {nc.title}</span>
                  <span className="meta">
                    {nc.criticality && <Badge tone={criticalityTone(nc.score)}>{nc.criticality}</Badge>}
                    {nc.process && <span>{nc.process}</span>}
                    {nc.custom && <Badge>افزوده کارشناس</Badge>}
                  </span>
                </span>
              </label>
              {(nc.ncDescription || nc.correctiveAction) && (
                <button type="button" className="btn ghost sm" onClick={() => setExpanded(open ? null : nc.id)}>{open ? 'بستن' : 'جزئیات'}</button>
              )}
              {open && (
                <dl className="kv text-sm" style={{ marginTop: 6 }}>
                  {nc.ncDescription && <><dt>شرح عدم انطباق</dt><dd>{nc.ncDescription}</dd></>}
                  {nc.correctiveAction && <><dt>اقدام اصلاحی</dt><dd>{nc.correctiveAction}</dd></>}
                  {nc.legalBasis && <><dt>الزام قانونی</dt><dd>{nc.legalBasis}</dd></>}
                  {nc.deadline && <><dt>مهلت رفع</dt><dd>{nc.deadline}</dd></>}
                </dl>
              )}
            </div>
          )
        })}
        {catalog && filtered.length === 60 && <p className="hint">فقط ۶۰ مورد اول نمایش داده شد؛ جستجو را دقیق‌تر کنید.</p>}
      </div>

      <NcFormModal
        open={adding}
        domainId={domainId}
        initialTitle={q}
        onClose={() => setAdding(false)}
        onSaved={(nc) => {
          onChange([...value, { ncId: nc.id }])
          setQ('')
        }}
      />
    </div>
  )
}

/** فرم افزودن/ویرایش یک مورد عدم انطباق در کاتالوگ */
export function NcFormModal({ open, domainId, existing, initialTitle, onClose, onSaved }: { open: boolean; domainId: string; existing?: NonConformance; initialTitle?: string; onClose: () => void; onSaved?: (nc: NonConformance) => void }) {
  return open ? <NcForm key={existing?.id ?? 'new'} domainId={domainId} existing={existing} initialTitle={initialTitle} onClose={onClose} onSaved={onSaved} /> : null
}

function NcForm({ domainId, existing, initialTitle, onClose, onSaved }: { domainId: string; existing?: NonConformance; initialTitle?: string; onClose: () => void; onSaved?: (nc: NonConformance) => void }) {
  const [f, setF] = useState({
    code: existing?.code ?? '',
    title: existing?.title ?? (initialTitle && !/^\d/.test(initialTitle) ? initialTitle : ''),
    questionType: existing?.questionType ?? '',
    process: existing?.process ?? '',
    ncDescription: existing?.ncDescription ?? '',
    legalBasis: existing?.legalBasis ?? '',
    correctiveAction: existing?.correctiveAction ?? '',
    score: existing?.score ?? 3,
    deadline: existing?.deadline ?? CRITICALITY_LEVELS[2].deadline,
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  function setScore(score: number) {
    const lvl = CRITICALITY_LEVELS.find((l) => l.score === score)
    setF((p) => ({ ...p, score, deadline: p.deadline === '' || CRITICALITY_LEVELS.some((l) => l.deadline === p.deadline) ? (lvl?.deadline ?? '') : p.deadline }))
  }

  async function save() {
    if (!f.title.trim()) return setErr('عنوان را وارد کنید')
    let code = f.code.trim()
    if (!code) {
      // شناسه خودکار برای موارد افزوده‌شده توسط کارشناس
      const n = await db.nonConformances.where('domainId').equals(domainId).filter((x) => x.custom).count()
      code = `C-${String(n + 1).padStart(3, '0')}`
    }
    const dup = await db.nonConformances.where('domainId').equals(domainId).filter((x) => x.code === code && x.id !== existing?.id).first()
    if (dup) return setErr(`شناسه ${code} قبلاً برای «${dup.title}» ثبت شده است`)
    const lvl = CRITICALITY_LEVELS.find((l) => l.score === f.score)
    const nc: NonConformance = {
      id: existing?.id ?? newId(),
      domainId,
      code,
      title: f.title.trim(),
      questionType: f.questionType || undefined,
      process: f.process.trim() || undefined,
      ncDescription: f.ncDescription.trim() || undefined,
      legalBasis: f.legalBasis.trim() || undefined,
      correctiveAction: f.correctiveAction.trim() || undefined,
      score: f.score,
      criticality: lvl?.label,
      deadline: f.deadline.trim() || undefined,
      custom: existing?.custom ?? true,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await db.nonConformances.put(nc)
    toast(existing ? 'ویرایش شد' : 'به کاتالوگ اضافه شد')
    onSaved?.(nc)
    onClose()
  }

  return (
    <Modal open title={existing ? 'ویرایش عدم انطباق' : 'افزودن عدم انطباق جدید'} onClose={onClose}>
      <div className="stack">
        <div className="grid-2">
          <Field label="شناسه" hint="خالی بگذارید تا خودکار ساخته شود">
            <input value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="مثلاً 308-222" dir="ltr" style={{ textAlign: 'right' }} />
          </Field>
          <Field label="درجه بحرانیت" required>
            <select value={f.score} onChange={(e) => setScore(Number(e.target.value))}>
              {CRITICALITY_LEVELS.map((l) => <option key={l.score} value={l.score}>{l.label} (ضریب {l.score})</option>)}
            </select>
          </Field>
        </div>
        <Field label="عنوان" required>
          <textarea value={f.title} onChange={(e) => set('title', e.target.value)} style={{ minHeight: 60 }} />
        </Field>
        <div className="grid-2">
          <Field label="نوع سؤال">
            <select value={f.questionType} onChange={(e) => set('questionType', e.target.value)}>
              <option value="">—</option>
              <option value="عمومی">عمومی</option>
              <option value="تخصصی">تخصصی</option>
            </select>
          </Field>
          <Field label="فرآیند / محل"><input value={f.process} onChange={(e) => set('process', e.target.value)} /></Field>
        </div>
        <Field label="شرح عدم انطباق"><textarea value={f.ncDescription} onChange={(e) => set('ncDescription', e.target.value)} style={{ minHeight: 60 }} /></Field>
        <Field label="اقدام کنترلی اصلاحی"><textarea value={f.correctiveAction} onChange={(e) => set('correctiveAction', e.target.value)} style={{ minHeight: 60 }} /></Field>
        <div className="grid-2">
          <Field label="الزام قانونی"><input value={f.legalBasis} onChange={(e) => set('legalBasis', e.target.value)} /></Field>
          <Field label="مهلت رفع"><input value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></Field>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>ذخیره</button>
          <button className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </Modal>
  )
}

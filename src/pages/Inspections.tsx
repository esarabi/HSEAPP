import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CHECKLIST_TEMPLATES } from '../data/templates'
import { db, newId } from '../db/db'
import type { CheckResult, ChecklistItem, Finding, Inspection, Severity } from '../db/types'
import { SEVERITY_LABEL } from '../db/types'
import { toJalali, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, Modal, PageHead, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { downloadCSV } from '../utils/export'
import { PhotoInput } from '../components/PhotoInput'

function summarize(items: ChecklistItem[]) {
  const ok = items.filter((i) => i.result === 'ok').length
  const nok = items.filter((i) => i.result === 'nok').length
  const na = items.filter((i) => i.result === 'na').length
  const answered = ok + nok + na
  return { ok, nok, na, answered, total: items.length }
}

export function InspectionList() {
  const list = useLiveQuery(() => db.inspections.orderBy('date').reverse().toArray(), [])
  const nav = useNavigate()
  function exportCsv() {
    if (!list?.length) return
    downloadCSV(
      `inspections-${todayISO()}.csv`,
      ['تاریخ', 'چک‌لیست', 'محل', 'بازرس', 'تعداد آیتم', 'مطابق', 'نامطابق', 'نامرتبط', 'یادداشت'],
      list.map((i) => {
        const s = summarize(i.items)
        return [toJalali(i.date), i.templateName, i.location, i.inspector, s.total, s.ok, s.nok, s.na, i.notes]
      }),
    )
  }
  return (
    <div>
      <PageHead
        title="بازرسی‌ها"
        sub="چک‌لیست‌های بازرسی دوره‌ای"
        actions={
          <>
            <Link to="/findings" className="btn sm">شرایط ناایمن</Link>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => nav('/inspections/new')}><IconPlus /> بازرسی جدید</button>
          </>
        }
      />
      {list && list.length === 0 && (
        <Empty text="هنوز بازرسی ثبت نشده است.">
          <button className="btn primary" onClick={() => nav('/inspections/new')}>شروع اولین بازرسی</button>
        </Empty>
      )}
      <div className="stack">
        {list?.map((i) => {
          const s = summarize(i.items)
          return (
            <Link key={i.id} to={`/inspections/${i.id}`} className="card clickable" style={{ color: 'inherit' }}>
              <div className="card-title">
                <h3>{i.templateName}</h3>
                {s.nok > 0 ? <Badge tone="danger">{s.nok} نامطابق</Badge> : s.answered === s.total ? <Badge tone="ok">بدون مغایرت</Badge> : <Badge>ناتمام</Badge>}
              </div>
              <div className="meta">
                <span>{toJalali(i.date)}</span>
                <span>{i.location}</span>
                <span>{i.inspector}</span>
                <span>{s.answered}/{s.total} آیتم</span>
              </div>
            </Link>
          )
        })}
      </div>
      <button className="fab" aria-label="بازرسی جدید" onClick={() => nav('/inspections/new')}><IconPlus /></button>
    </div>
  )
}

export function InspectionNew() {
  const nav = useNavigate()
  const [templateId, setTemplateId] = useState(CHECKLIST_TEMPLATES[0].id)
  const [date, setDate] = useState(todayISO())
  const [location, setLocation] = useState('')
  const [inspector, setInspector] = useState(() => localStorage.getItem('hse.inspector') ?? '')
  const [err, setErr] = useState('')

  async function start() {
    if (!location.trim()) return setErr('محل بازرسی را وارد کنید')
    const tpl = CHECKLIST_TEMPLATES.find((t) => t.id === templateId)!
    const id = newId()
    const insp: Inspection = {
      id,
      date,
      templateId,
      templateName: tpl.name,
      location: location.trim(),
      inspector: inspector.trim(),
      items: tpl.items.map((text) => ({ id: newId(), text, result: '' })),
      createdAt: Date.now(),
    }
    localStorage.setItem('hse.inspector', inspector.trim())
    await db.inspections.add(insp)
    nav(`/inspections/${id}`, { replace: true })
  }

  return (
    <div>
      <PageHead title="بازرسی جدید" back="/inspections" />
      <div className="card stack">
        <Field label="چک‌لیست" required>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {CHECKLIST_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.items.length} آیتم)</option>
            ))}
          </select>
        </Field>
        <Field label="تاریخ" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="محل / واحد" required>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="مثلاً سالن تولید ۲" />
        </Field>
        <Field label="نام بازرس">
          <input value={inspector} onChange={(e) => setInspector(e.target.value)} />
        </Field>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={start}>شروع بازرسی</button>
          <button className="btn" onClick={() => nav('/inspections')}>انصراف</button>
        </div>
      </div>
    </div>
  )
}

export function InspectionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const insp = useLiveQuery(() => (id ? db.inspections.get(id) : undefined), [id])
  const findings = useLiveQuery(() => (id ? db.findings.where('inspectionId').equals(id).toArray() : []), [id])
  const [confirm, setConfirm] = useState(false)
  const [findingFor, setFindingFor] = useState<ChecklistItem | null>(null)

  if (insp === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!insp) return <Empty text="بازرسی پیدا نشد" />
  const s = summarize(insp.items)

  async function setResult(item: ChecklistItem, result: CheckResult) {
    if (!insp) return
    const items = insp.items.map((i) => (i.id === item.id ? { ...i, result } : i))
    await db.inspections.update(insp.id, { items })
    if (result === 'nok' && !findings?.some((f) => f.description.startsWith(item.text))) {
      setFindingFor({ ...item, result })
    }
  }
  async function setNote(item: ChecklistItem, note: string) {
    if (!insp) return
    const items = insp.items.map((i) => (i.id === item.id ? { ...i, note } : i))
    await db.inspections.update(insp.id, { items })
  }
  async function remove() {
    await db.inspections.delete(insp!.id)
    toast('بازرسی حذف شد')
    nav('/inspections', { replace: true })
  }

  return (
    <div>
      <PageHead
        title={insp.templateName}
        sub={`${toJalali(insp.date)} · ${insp.location}${insp.inspector ? ' · ' + insp.inspector : ''}`}
        back="/inspections"
        actions={<button className="btn sm danger" onClick={() => setConfirm(true)}><IconTrash /> حذف</button>}
      />
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="text-sm">پیشرفت: {s.answered} از {s.total}</span>
          <span className="row text-sm">
            <Badge tone="ok">{s.ok} مطابق</Badge>
            <Badge tone="danger">{s.nok} نامطابق</Badge>
            <Badge>{s.na} نامرتبط</Badge>
          </span>
        </div>
        <div className="progress mt"><div style={{ width: `${(s.answered / s.total) * 100}%` }} /></div>
      </div>

      <div className="card mt">
        {insp.items.map((item, idx) => (
          <div key={item.id} className="check-item">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="text">{idx + 1}. {item.text}</span>
              <div className="seg">
                <button className={`ok ${item.result === 'ok' ? 'active' : ''}`} onClick={() => setResult(item, 'ok')}>مطابق</button>
                <button className={`nok ${item.result === 'nok' ? 'active' : ''}`} onClick={() => setResult(item, 'nok')}>نامطابق</button>
                <button className={`na ${item.result === 'na' ? 'active' : ''}`} onClick={() => setResult(item, 'na')}>N/A</button>
              </div>
            </div>
            {(item.result === 'nok' || item.note) && (
              <input
                className="input"
                placeholder="توضیح مغایرت…"
                defaultValue={item.note ?? ''}
                onBlur={(e) => e.target.value !== (item.note ?? '') && setNote(item, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <Field label="یادداشت کلی بازرسی">
        <textarea defaultValue={insp.notes ?? ''} onBlur={(e) => db.inspections.update(insp.id, { notes: e.target.value })} />
      </Field>

      {findings && findings.length > 0 && (
        <>
          <div className="section-title"><h2>شرایط ناایمن ثبت‌شده از این بازرسی</h2></div>
          <div className="card">
            {findings.map((f) => (
              <Link key={f.id} to="/findings" className="list-item" style={{ color: 'inherit' }}>
                <div className="body">
                  <div className="title">{f.description}</div>
                  <div className="meta"><span>{f.responsible}</span>{f.dueDate && <span>مهلت: {toJalali(f.dueDate)}</span>}</div>
                </div>
                <Badge tone={f.status === 'done' ? 'ok' : 'warn'}>{f.status === 'done' ? 'رفع شد' : 'باز'}</Badge>
              </Link>
            ))}
          </div>
        </>
      )}

      <Confirm open={confirm} text="این بازرسی حذف شود؟ (شرایط ناایمن ثبت‌شده حذف نمی‌شوند)" onCancel={() => setConfirm(false)} onConfirm={remove} />
      <FindingModal
        open={!!findingFor}
        onClose={() => setFindingFor(null)}
        initial={findingFor ? { description: findingFor.text, location: insp.location, date: insp.date, inspectionId: insp.id } : undefined}
      />
    </div>
  )
}

/** فرم ثبت/ویرایش شرایط ناایمن؛ هم در بازرسی و هم در صفحه شرایط ناایمن استفاده می‌شود */
export function FindingModal({ open, onClose, initial, existing }: { open: boolean; onClose: () => void; initial?: Partial<Finding>; existing?: Finding }) {
  return open ? <FindingForm onClose={onClose} initial={initial} existing={existing} /> : null
}

function FindingForm({ onClose, initial, existing }: { onClose: () => void; initial?: Partial<Finding>; existing?: Finding }) {
  const base = existing ?? initial ?? {}
  const [f, setF] = useState<Omit<Finding, 'id' | 'createdAt'>>({
    date: base.date ?? todayISO(),
    location: base.location ?? '',
    description: base.description ?? '',
    severity: base.severity ?? 'medium',
    correctiveAction: base.correctiveAction ?? '',
    responsible: base.responsible ?? '',
    dueDate: base.dueDate ?? '',
    status: base.status ?? 'open',
    inspectionId: base.inspectionId,
    photoId: base.photoId,
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.description.trim()) return setErr('شرح مورد را وارد کنید')
    if (!f.location.trim()) return setErr('محل را وارد کنید')
    if (existing) {
      await db.findings.update(existing.id, f)
    } else {
      await db.findings.add({ ...f, id: newId(), createdAt: Date.now() })
    }
    toast('ذخیره شد')
    onClose()
  }

  return (
    <Modal open title={existing ? 'ویرایش شرایط ناایمن' : 'ثبت شرایط ناایمن'} onClose={onClose}>
      <div className="stack">
        <Field label="شرح مورد ناایمن" required>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label="تاریخ مشاهده" required>
            <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="محل" required>
            <input value={f.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="شدت ریسک">
            <select value={f.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
              {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="وضعیت">
            <select value={f.status} onChange={(e) => set('status', e.target.value as Finding['status'])}>
              <option value="open">باز</option>
              <option value="in_progress">در حال انجام</option>
              <option value="done">رفع شده</option>
            </select>
          </Field>
          <Field label="مسئول رفع">
            <input value={f.responsible} onChange={(e) => set('responsible', e.target.value)} />
          </Field>
          <Field label="مهلت رفع">
            <input type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        <Field label="اقدام اصلاحی پیشنهادی">
          <textarea value={f.correctiveAction} onChange={(e) => set('correctiveAction', e.target.value)} />
        </Field>
        <PhotoInput value={f.photoId} onChange={(v) => set('photoId', v)} />
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>ذخیره</button>
          <button className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </Modal>
  )
}


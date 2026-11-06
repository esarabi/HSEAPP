import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { COMMON_COURSES } from '../data/templates'
import { db, newId } from '../db/db'
import type { Person, Training } from '../db/types'
import { addMonths, daysUntil, relativeDays, toJalali, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, Modal, PageHead, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { downloadCSV } from '../utils/export'

function expiryBadge(iso?: string) {
  const n = daysUntil(iso)
  if (n === null) return null
  if (n < 0) return <Badge tone="danger">منقضی ({relativeDays(iso)})</Badge>
  if (n <= 30) return <Badge tone="warn">{relativeDays(iso)}</Badge>
  return <Badge tone="ok">معتبر</Badge>
}

export function PeopleList() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Person | null | 'new'>(null)
  const persons = useLiveQuery(() => db.persons.orderBy('name').toArray(), [])
  const trainings = useLiveQuery(() => db.trainings.toArray(), [])
  const filtered = persons?.filter((p) => !q || p.name.includes(q) || (p.unit ?? '').includes(q) || (p.personnelCode ?? '').includes(q))

  function expiringCount(pid: string) {
    const limit = addMonths(todayISO(), 1)
    return trainings?.filter((t) => t.personId === pid && t.expiryDate && t.expiryDate <= limit).length ?? 0
  }
  function exportCsv() {
    if (!persons?.length) return
    downloadCSV(
      `training-${todayISO()}.csv`,
      ['نام', 'کد پرسنلی', 'واحد', 'سمت', 'دوره', 'تاریخ', 'انقضا', 'ساعت', 'مدرس', 'شماره گواهی'],
      (trainings ?? []).map((t) => {
        const p = persons.find((x) => x.id === t.personId)
        return [p?.name, p?.personnelCode, p?.unit, p?.jobTitle, t.course, toJalali(t.date), t.expiryDate ? toJalali(t.expiryDate) : '', t.hours, t.instructor, t.certificateNo]
      }),
    )
  }

  return (
    <div>
      <PageHead
        title="پرسنل و آموزش"
        actions={
          <>
            <button className="btn sm" onClick={exportCsv} disabled={!trainings?.length}>خروجی CSV آموزش</button>
            <button className="btn primary sm" onClick={() => setEditing('new')}><IconPlus /> افزودن فرد</button>
          </>
        }
      />
      <div className="toolbar">
        <input className="input" placeholder="جستجوی نام، واحد یا کد…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered && filtered.length === 0 && <Empty text="فردی ثبت نشده است." />}
      <div className="stack">
        {filtered?.map((p) => {
          const n = expiringCount(p.id)
          return (
            <Link key={p.id} to={`/people/${p.id}`} className="card clickable" style={{ color: 'inherit' }}>
              <div className="card-title">
                <h3>{p.name}</h3>
                <div className="row">
                  {n > 0 && <Badge tone="warn">{n} آموزش در حال انقضا</Badge>}
                  {p.medicalExamExpiry && (daysUntil(p.medicalExamExpiry) ?? 99) <= 30 && <Badge tone="danger">معاینه</Badge>}
                </div>
              </div>
              <div className="meta">
                {p.personnelCode && <span>کد {p.personnelCode}</span>}
                {p.unit && <span>{p.unit}</span>}
                {p.jobTitle && <span>{p.jobTitle}</span>}
              </div>
            </Link>
          )
        })}
      </div>
      <button className="fab" aria-label="افزودن فرد" onClick={() => setEditing('new')}><IconPlus /></button>
      <PersonModal open={!!editing} existing={editing && editing !== 'new' ? editing : undefined} onClose={() => setEditing(null)} onSaved={(id) => nav(`/people/${id}`)} />
    </div>
  )
}

export function PersonDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const p = useLiveQuery(() => (id ? db.persons.get(id) : undefined), [id])
  const trainings = useLiveQuery(() => (id ? db.trainings.where('personId').equals(id).reverse().sortBy('date') : []), [id])
  const [edit, setEdit] = useState(false)
  const [addT, setAddT] = useState<Training | null | 'new'>(null)
  const [del, setDel] = useState(false)
  const [delT, setDelT] = useState<Training | null>(null)
  if (p === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!p) return <Empty text="فرد پیدا نشد" />

  async function remove() {
    await db.trainings.where('personId').equals(p!.id).delete()
    await db.persons.delete(p!.id)
    toast('حذف شد')
    nav('/people', { replace: true })
  }

  return (
    <div>
      <PageHead
        title={p.name}
        sub={[p.personnelCode && `کد ${p.personnelCode}`, p.unit, p.jobTitle].filter(Boolean).join(' · ')}
        back="/people"
        actions={
          <>
            <button className="btn sm" onClick={() => setEdit(true)}>ویرایش</button>
            <button className="btn sm danger" onClick={() => setDel(true)}><IconTrash /></button>
          </>
        }
      />
      <div className="card">
        <dl className="kv">
          {p.phone && <><dt>تلفن</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{p.phone}</dd></>}
          <dt>معاینه دوره‌ای</dt>
          <dd className="row">
            {p.medicalExamDate ? toJalali(p.medicalExamDate) : <span className="text-muted">ثبت نشده</span>}
            {p.medicalExamExpiry && <span className="text-muted text-sm">تا {toJalali(p.medicalExamExpiry)}</span>}
            {expiryBadge(p.medicalExamExpiry)}
          </dd>
        </dl>
      </div>

      <div className="section-title">
        <h2>سوابق آموزشی</h2>
        <button className="btn sm primary" onClick={() => setAddT('new')}><IconPlus /> ثبت آموزش</button>
      </div>
      <div className="card">
        {trainings?.length === 0 && <p className="text-muted text-sm">آموزشی ثبت نشده است.</p>}
        {trainings?.map((t) => (
          <div key={t.id} className="list-item">
            <div className="body">
              <div className="title">{t.course}</div>
              <div className="meta">
                <span>{toJalali(t.date)}</span>
                {t.expiryDate && <span>انقضا: {toJalali(t.expiryDate)}</span>}
                {t.hours ? <span>{t.hours} ساعت</span> : null}
                {t.instructor && <span>{t.instructor}</span>}
                {t.certificateNo && <span>گواهی {t.certificateNo}</span>}
              </div>
            </div>
            {expiryBadge(t.expiryDate)}
            <button className="btn ghost sm" onClick={() => setAddT(t)}>ویرایش</button>
            <button className="btn ghost sm" onClick={() => setDelT(t)}><IconTrash /></button>
          </div>
        ))}
      </div>

      <PersonModal open={edit} existing={p} onClose={() => setEdit(false)} />
      <TrainingModal open={!!addT} personId={p.id} existing={addT && addT !== 'new' ? addT : undefined} onClose={() => setAddT(null)} />
      <Confirm open={del} text="این فرد و همه سوابق آموزشی‌اش حذف شود؟" onCancel={() => setDel(false)} onConfirm={remove} />
      <Confirm open={!!delT} text="این سابقه آموزشی حذف شود؟" onCancel={() => setDelT(null)} onConfirm={async () => { await db.trainings.delete(delT!.id); setDelT(null) }} />
    </div>
  )
}

function PersonModal({ open, existing, onClose, onSaved }: { open: boolean; existing?: Person; onClose: () => void; onSaved?: (id: string) => void }) {
  return open ? <PersonForm key={existing?.id ?? 'new'} existing={existing} onClose={onClose} onSaved={onSaved} /> : null
}

function PersonForm({ existing, onClose, onSaved }: { existing?: Person; onClose: () => void; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Omit<Person, 'id' | 'createdAt'>>({
    name: existing?.name ?? '',
    personnelCode: existing?.personnelCode ?? '',
    unit: existing?.unit ?? '',
    jobTitle: existing?.jobTitle ?? '',
    phone: existing?.phone ?? '',
    medicalExamDate: existing?.medicalExamDate ?? '',
    medicalExamExpiry: existing?.medicalExamExpiry ?? '',
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  function setExam(d: string) {
    setF((p) => ({ ...p, medicalExamDate: d, medicalExamExpiry: d ? addMonths(d, 12) : '' }))
  }
  async function save() {
    if (!f.name.trim()) return setErr('نام را وارد کنید')
    const id = existing?.id ?? newId()
    if (existing) await db.persons.update(id, f)
    else await db.persons.add({ ...f, id, createdAt: Date.now() })
    toast('ذخیره شد')
    onClose()
    if (!existing) onSaved?.(id)
  }
  return (
    <Modal open title={existing ? 'ویرایش فرد' : 'افزودن فرد'} onClose={onClose}>
      <div className="stack">
        <Field label="نام و نام خانوادگی" required>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label="کد پرسنلی"><input value={f.personnelCode} onChange={(e) => set('personnelCode', e.target.value)} /></Field>
          <Field label="واحد"><input value={f.unit} onChange={(e) => set('unit', e.target.value)} /></Field>
          <Field label="سمت"><input value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} /></Field>
          <Field label="تلفن"><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="تاریخ معاینه دوره‌ای" hint="انقضا به‌طور پیش‌فرض یک سال بعد">
            <input type="date" value={f.medicalExamDate} onChange={(e) => setExam(e.target.value)} />
          </Field>
          <Field label="انقضای معاینه">
            <input type="date" value={f.medicalExamExpiry} onChange={(e) => set('medicalExamExpiry', e.target.value)} />
          </Field>
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

function TrainingModal({ open, personId, existing, onClose }: { open: boolean; personId: string; existing?: Training; onClose: () => void }) {
  return open ? <TrainingForm key={existing?.id ?? 'new'} personId={personId} existing={existing} onClose={onClose} /> : null
}

function TrainingForm({ personId, existing, onClose }: { personId: string; existing?: Training; onClose: () => void }) {
  const [f, setF] = useState<Omit<Training, 'id' | 'createdAt' | 'personId'>>({
    course: existing?.course ?? '',
    date: existing?.date ?? todayISO(),
    expiryDate: existing?.expiryDate ?? '',
    hours: existing?.hours ?? 0,
    instructor: existing?.instructor ?? '',
    certificateNo: existing?.certificateNo ?? '',
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  async function save() {
    if (!f.course.trim()) return setErr('نام دوره را وارد کنید')
    if (existing) await db.trainings.update(existing.id, f)
    else await db.trainings.add({ ...f, id: newId(), personId, createdAt: Date.now() })
    toast('ذخیره شد')
    onClose()
  }
  return (
    <Modal open title={existing ? 'ویرایش آموزش' : 'ثبت آموزش'} onClose={onClose}>
      <div className="stack">
        <Field label="عنوان دوره" required>
          <input list="courses" value={f.course} onChange={(e) => set('course', e.target.value)} />
          <datalist id="courses">{COMMON_COURSES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid-2">
          <Field label="تاریخ برگزاری" required><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="تاریخ انقضا">
            <input type="date" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
          </Field>
          <Field label="مدت (ساعت)"><input type="number" min={0} value={f.hours ?? 0} onChange={(e) => set('hours', Number(e.target.value) || 0)} /></Field>
          <Field label="مدرس"><input value={f.instructor} onChange={(e) => set('instructor', e.target.value)} /></Field>
          <Field label="شماره گواهی"><input value={f.certificateNo} onChange={(e) => set('certificateNo', e.target.value)} /></Field>
        </div>
        <div className="row">
          <span className="hint">انقضا:</span>
          {[12, 24, 36].map((m) => (
            <button key={m} type="button" className="chip" onClick={() => set('expiryDate', addMonths(f.date, m))}>{m / 12} سال</button>
          ))}
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

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId } from '../db/db'
import type { Incident, IncidentType, Severity } from '../db/types'
import { ACTION_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from '../db/types'
import { toJalali, toJalaliLong, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, PageHead, Photo, severityTone, statusTone, toast } from '../components/ui'
import { DateInput } from '../components/DateInput'
import { IconPlus, IconTrash } from '../components/Icons'
import { PhotoInput } from '../components/PhotoInput'
import { downloadCSV } from '../utils/export'
import { deletePhoto } from '../utils/photo'

export function IncidentList() {
  const nav = useNavigate()
  const [type, setType] = useState<IncidentType | 'all'>('all')
  const [q, setQ] = useState('')
  const list = useLiveQuery(async () => {
    let rows = await db.incidents.orderBy('date').reverse().toArray()
    if (type !== 'all') rows = rows.filter((r) => r.type === type)
    if (q.trim()) rows = rows.filter((r) => r.title.includes(q) || r.location.includes(q) || r.description.includes(q))
    return rows
  }, [type, q])

  function exportCsv() {
    if (!list?.length) return
    downloadCSV(
      `incidents-${todayISO()}.csv`,
      ['تاریخ', 'ساعت', 'نوع', 'عنوان', 'محل', 'شرح', 'افراد درگیر', 'شدت', 'روزهای ازدست‌رفته', 'علت ریشه‌ای', 'اقدام اصلاحی', 'مسئول', 'مهلت', 'وضعیت'],
      list.map((i) => [toJalali(i.date), i.time, INCIDENT_TYPE_LABEL[i.type], i.title, i.location, i.description, i.personsInvolved, SEVERITY_LABEL[i.severity], i.lostDays, i.rootCause, i.correctiveAction, i.responsible, i.dueDate ? toJalali(i.dueDate) : '', ACTION_STATUS_LABEL[i.status]]),
    )
  }

  return (
    <div>
      <PageHead
        title="حوادث و شبه‌حوادث"
        actions={
          <>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => nav('/incidents/new')}><IconPlus /> ثبت حادثه</button>
          </>
        }
      />
      <div className="toolbar">
        <input className="input" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={type} onChange={(e) => setType(e.target.value as IncidentType | 'all')}>
          <option value="all">همه انواع</option>
          {(Object.keys(INCIDENT_TYPE_LABEL) as IncidentType[]).map((t) => <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>)}
        </select>
      </div>
      {list && list.length === 0 && <Empty text="حادثه‌ای ثبت نشده است." />}
      <div className="stack">
        {list?.map((i) => (
          <Link key={i.id} to={`/incidents/${i.id}`} className="card clickable" style={{ color: 'inherit' }}>
            <div className="card-title">
              <h3>{i.title}</h3>
              <Badge tone={severityTone(i.severity)}>{SEVERITY_LABEL[i.severity]}</Badge>
            </div>
            <div className="meta">
              <span>{INCIDENT_TYPE_LABEL[i.type]}</span>
              <span>{toJalali(i.date)}</span>
              <span>{i.location}</span>
              <Badge tone={statusTone(i.status)}>{ACTION_STATUS_LABEL[i.status]}</Badge>
            </div>
          </Link>
        ))}
      </div>
      <button className="fab" aria-label="ثبت حادثه" onClick={() => nav('/incidents/new')}><IconPlus /></button>
    </div>
  )
}

export function IncidentDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const inc = useLiveQuery(() => (id ? db.incidents.get(id) : undefined), [id])
  const [confirm, setConfirm] = useState(false)
  if (inc === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!inc) return <Empty text="حادثه پیدا نشد" />

  async function remove() {
    await deletePhoto(inc!.photoId)
    await db.incidents.delete(inc!.id)
    toast('حذف شد')
    nav('/incidents', { replace: true })
  }

  return (
    <div>
      <PageHead
        title={inc.title}
        sub={`${INCIDENT_TYPE_LABEL[inc.type]} · ${toJalaliLong(inc.date)}${inc.time ? ' · ' + inc.time : ''}`}
        back="/incidents"
        actions={
          <>
            <button className="btn sm" onClick={() => nav(`/incidents/${inc.id}/edit`)}>ویرایش</button>
            <button className="btn sm danger" onClick={() => setConfirm(true)}><IconTrash /> حذف</button>
          </>
        }
      />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <Badge tone={severityTone(inc.severity)}>شدت: {SEVERITY_LABEL[inc.severity]}</Badge>
          <Badge tone={statusTone(inc.status)}>{ACTION_STATUS_LABEL[inc.status]}</Badge>
          {inc.lostDays ? <Badge tone="warn">{inc.lostDays} روز ازدست‌رفته</Badge> : null}
        </div>
        <dl className="kv">
          <dt>محل</dt><dd>{inc.location}</dd>
          <dt>شرح</dt><dd className="pre">{inc.description}</dd>
          {inc.personsInvolved && <><dt>افراد درگیر</dt><dd>{inc.personsInvolved}</dd></>}
          {inc.rootCause && <><dt>علت ریشه‌ای</dt><dd className="pre">{inc.rootCause}</dd></>}
          {inc.correctiveAction && <><dt>اقدام اصلاحی</dt><dd className="pre">{inc.correctiveAction}</dd></>}
          {inc.responsible && <><dt>مسئول پیگیری</dt><dd>{inc.responsible}</dd></>}
          {inc.dueDate && <><dt>مهلت</dt><dd>{toJalali(inc.dueDate)}</dd></>}
        </dl>
        {inc.photoId && <div className="mt"><Photo id={inc.photoId} /></div>}
      </div>
      <Confirm open={confirm} text="این حادثه حذف شود؟" onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  )
}

export function IncidentForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const existing = useLiveQuery(() => (id ? db.incidents.get(id) : undefined), [id])
  if (id && existing === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (id && !existing) return <Empty text="حادثه پیدا نشد" />
  return <IncidentEditor key={id ?? 'new'} existing={existing} onDone={(newId) => nav(`/incidents/${newId}`, { replace: true })} />
}

function IncidentEditor({ existing, onDone }: { existing?: Incident; onDone: (id: string) => void }) {
  const nav = useNavigate()
  const [f, setF] = useState<Omit<Incident, 'id' | 'createdAt'>>({
    date: existing?.date ?? todayISO(),
    time: existing?.time ?? '',
    type: existing?.type ?? 'near_miss',
    location: existing?.location ?? '',
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    personsInvolved: existing?.personsInvolved ?? '',
    severity: existing?.severity ?? 'medium',
    lostDays: existing?.lostDays ?? 0,
    rootCause: existing?.rootCause ?? '',
    correctiveAction: existing?.correctiveAction ?? '',
    responsible: existing?.responsible ?? '',
    dueDate: existing?.dueDate ?? '',
    status: existing?.status ?? 'open',
    photoId: existing?.photoId,
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.title.trim()) return setErr('عنوان را وارد کنید')
    if (!f.location.trim()) return setErr('محل را وارد کنید')
    if (!f.description.trim()) return setErr('شرح حادثه را وارد کنید')
    const id = existing?.id ?? newId()
    if (existing) await db.incidents.update(id, f)
    else await db.incidents.add({ ...f, id, createdAt: Date.now() })
    toast('ذخیره شد')
    onDone(id)
  }

  return (
    <div>
      <PageHead title={existing ? 'ویرایش حادثه' : 'ثبت حادثه / شبه‌حادثه'} back />
      <div className="card stack">
        <Field label="عنوان" required>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً سقوط ابزار از ارتفاع" />
        </Field>
        <div className="grid-2">
          <Field label="نوع" required>
            <select value={f.type} onChange={(e) => set('type', e.target.value as IncidentType)}>
              {(Object.keys(INCIDENT_TYPE_LABEL) as IncidentType[]).map((t) => <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="شدت" required>
            <select value={f.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
              {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="تاریخ" required>
            <DateInput value={f.date} onChange={(d) => set('date', d)} />
          </Field>
          <Field label="ساعت">
            <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
          <Field label="محل" required>
            <input value={f.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="افراد درگیر">
            <input value={f.personsInvolved} onChange={(e) => set('personsInvolved', e.target.value)} placeholder="نام و واحد" />
          </Field>
        </div>
        <Field label="شرح حادثه" required>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="علت ریشه‌ای">
          <textarea value={f.rootCause} onChange={(e) => set('rootCause', e.target.value)} placeholder="نتیجه تحلیل علل (مثلاً ۵ چرا)" />
        </Field>
        <Field label="اقدام اصلاحی / پیشگیرانه">
          <textarea value={f.correctiveAction} onChange={(e) => set('correctiveAction', e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label="مسئول پیگیری">
            <input value={f.responsible} onChange={(e) => set('responsible', e.target.value)} />
          </Field>
          <Field label="مهلت اقدام">
            <DateInput value={f.dueDate ?? ''} onChange={(d) => set('dueDate', d)} />
          </Field>
          <Field label="روزهای ازدست‌رفته">
            <input type="number" min={0} value={f.lostDays ?? 0} onChange={(e) => set('lostDays', Number(e.target.value) || 0)} />
          </Field>
          <Field label="وضعیت پیگیری">
            <select value={f.status} onChange={(e) => set('status', e.target.value as Incident['status'])}>
              <option value="open">باز</option>
              <option value="in_progress">در حال انجام</option>
              <option value="done">بسته شده</option>
            </select>
          </Field>
        </div>
        <PhotoInput value={f.photoId} onChange={(v) => set('photoId', v)} />
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>ذخیره</button>
          <button className="btn" onClick={() => nav(-1)}>انصراف</button>
        </div>
      </div>
    </div>
  )
}

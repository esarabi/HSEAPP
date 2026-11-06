import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PERMIT_PRECAUTIONS } from '../data/templates'
import { db, newId } from '../db/db'
import type { Permit, PermitStatus, PermitType } from '../db/types'
import { PERMIT_STATUS_LABEL, PERMIT_TYPE_LABEL } from '../db/types'
import { nowLocalISO, toJalaliDateTime, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, PageHead, statusTone, toast } from '../components/ui'
import { DateTimeInput } from '../components/DateInput'
import { IconPlus, IconTrash } from '../components/Icons'
import { downloadCSV } from '../utils/export'

function permitBadge(p: Permit) {
  if (p.status === 'active' && new Date(p.endAt).getTime() < Date.now()) return <Badge tone="danger">منقضی (باز)</Badge>
  return <Badge tone={statusTone(p.status)}>{PERMIT_STATUS_LABEL[p.status]}</Badge>
}

export function PermitList() {
  const nav = useNavigate()
  const [filter, setFilter] = useState<PermitStatus | 'all'>('active')
  const list = useLiveQuery(async () => {
    const rows = await db.permits.orderBy('startAt').reverse().toArray()
    return filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  }, [filter])

  function exportCsv() {
    if (!list?.length) return
    downloadCSV(
      `permits-${todayISO()}.csv`,
      ['شماره', 'نوع', 'محل', 'شرح کار', 'پیمانکار', 'سرپرست', 'صادرکننده', 'شروع', 'پایان', 'وضعیت'],
      list.map((p) => [p.number, PERMIT_TYPE_LABEL[p.type], p.location, p.description, p.contractor, p.supervisor, p.issuer, toJalaliDateTime(p.startAt), toJalaliDateTime(p.endAt), PERMIT_STATUS_LABEL[p.status]]),
    )
  }

  return (
    <div>
      <PageHead
        title="مجوز کار (PTW)"
        actions={
          <>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => nav('/permits/new')}><IconPlus /> صدور مجوز</button>
          </>
        }
      />
      <div className="chips">
        {([['active', 'فعال'], ['closed', 'بسته'], ['cancelled', 'لغو'], ['all', 'همه']] as [PermitStatus | 'all', string][]).map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {list && list.length === 0 && <Empty text="مجوزی در این دسته وجود ندارد." />}
      <div className="stack">
        {list?.map((p) => (
          <Link key={p.id} to={`/permits/${p.id}`} className="card clickable" style={{ color: 'inherit' }}>
            <div className="card-title">
              <h3>{PERMIT_TYPE_LABEL[p.type]} — {p.location}</h3>
              {permitBadge(p)}
            </div>
            <div className="meta">
              <span>شماره {p.number}</span>
              <span>{p.contractor}</span>
              <span>{toJalaliDateTime(p.startAt)} تا {toJalaliDateTime(p.endAt)}</span>
            </div>
          </Link>
        ))}
      </div>
      <button className="fab" aria-label="صدور مجوز" onClick={() => nav('/permits/new')}><IconPlus /></button>
    </div>
  )
}

export function PermitDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const p = useLiveQuery(() => (id ? db.permits.get(id) : undefined), [id])
  const [confirm, setConfirm] = useState(false)
  if (p === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!p) return <Empty text="مجوز پیدا نشد" />

  async function toggle(pid: string) {
    if (!p) return
    const precautions = p.precautions.map((x) => (x.id === pid ? { ...x, done: !x.done } : x))
    await db.permits.update(p.id, { precautions })
  }
  async function setStatus(status: PermitStatus) {
    await db.permits.update(p!.id, { status, closedAt: status === 'active' ? undefined : Date.now() })
    toast(status === 'closed' ? 'مجوز بسته شد' : status === 'cancelled' ? 'مجوز لغو شد' : 'مجوز فعال شد')
  }
  async function remove() {
    await db.permits.delete(p!.id)
    toast('حذف شد')
    nav('/permits', { replace: true })
  }
  const doneCount = p.precautions.filter((x) => x.done).length

  return (
    <div>
      <PageHead
        title={`${PERMIT_TYPE_LABEL[p.type]} — ${p.number}`}
        sub={p.location}
        back="/permits"
        actions={<button className="btn sm danger" onClick={() => setConfirm(true)}><IconTrash /></button>}
      />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>{permitBadge(p)}</div>
        <dl className="kv">
          <dt>شرح کار</dt><dd className="pre">{p.description}</dd>
          <dt>پیمانکار / مجری</dt><dd>{p.contractor}</dd>
          <dt>سرپرست کار</dt><dd>{p.supervisor}</dd>
          <dt>صادرکننده</dt><dd>{p.issuer}</dd>
          <dt>شروع</dt><dd>{toJalaliDateTime(p.startAt)}</dd>
          <dt>پایان</dt><dd>{toJalaliDateTime(p.endAt)}</dd>
        </dl>
      </div>
      <div className="section-title">
        <h2>اقدامات احتیاطی</h2>
        <span className="text-sm text-muted">{doneCount}/{p.precautions.length}</span>
      </div>
      <div className="card">
        {p.precautions.length === 0 && <p className="text-muted text-sm">اقدامی تعریف نشده است.</p>}
        {p.precautions.map((x) => (
          <label key={x.id} className="list-item check">
            <input type="checkbox" checked={x.done} disabled={p.status !== 'active'} onChange={() => toggle(x.id)} />
            <span className={x.done ? 'text-muted' : ''}>{x.text}</span>
          </label>
        ))}
      </div>
      <div className="form-actions">
        {p.status === 'active' ? (
          <>
            <button className="btn primary" onClick={() => setStatus('closed')}>بستن مجوز (پایان کار)</button>
            <button className="btn danger" onClick={() => setStatus('cancelled')}>لغو مجوز</button>
          </>
        ) : (
          <button className="btn" onClick={() => setStatus('active')}>فعال‌سازی مجدد</button>
        )}
      </div>
      <Confirm open={confirm} text="این مجوز حذف شود؟" onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  )
}

export function PermitNew() {
  const nav = useNavigate()
  const count = useLiveQuery(() => db.permits.count(), [])
  const [type, setType] = useState<PermitType>('hot_work')
  const [f, setF] = useState({
    number: '',
    location: '',
    description: '',
    contractor: '',
    supervisor: '',
    issuer: localStorage.getItem('hse.inspector') ?? '',
    startAt: nowLocalISO(),
    endAt: '',
  })
  const [precautions, setPrecautions] = useState<string[]>(PERMIT_PRECAUTIONS.hot_work)
  const [extra, setExtra] = useState('')
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function changeType(t: PermitType) {
    setType(t)
    setPrecautions(PERMIT_PRECAUTIONS[t] ?? [])
  }
  const autoNumber = `PTW-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`

  async function save() {
    if (!f.location.trim()) return setErr('محل کار را وارد کنید')
    if (!f.description.trim()) return setErr('شرح کار را وارد کنید')
    if (!f.endAt) return setErr('زمان پایان را مشخص کنید')
    if (f.endAt <= f.startAt) return setErr('زمان پایان باید بعد از شروع باشد')
    const id = newId()
    const permit: Permit = {
      id,
      number: f.number.trim() || autoNumber,
      type,
      location: f.location.trim(),
      description: f.description.trim(),
      contractor: f.contractor.trim(),
      supervisor: f.supervisor.trim(),
      issuer: f.issuer.trim(),
      startAt: f.startAt,
      endAt: f.endAt,
      precautions: precautions.map((text) => ({ id: newId(), text, done: false })),
      status: 'active',
      createdAt: Date.now(),
    }
    await db.permits.add(permit)
    toast('مجوز صادر شد')
    nav(`/permits/${id}`, { replace: true })
  }

  return (
    <div>
      <PageHead title="صدور مجوز کار" back="/permits" />
      <div className="card stack">
        <div className="grid-2">
          <Field label="نوع مجوز" required>
            <select value={type} onChange={(e) => changeType(e.target.value as PermitType)}>
              {(Object.keys(PERMIT_TYPE_LABEL) as PermitType[]).map((t) => <option key={t} value={t}>{PERMIT_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="شماره مجوز" hint={`خالی بگذارید تا خودکار ${autoNumber} ثبت شود`}>
            <input value={f.number} onChange={(e) => set('number', e.target.value)} placeholder={autoNumber} />
          </Field>
          <Field label="محل کار" required>
            <input value={f.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="پیمانکار / مجری">
            <input value={f.contractor} onChange={(e) => set('contractor', e.target.value)} />
          </Field>
          <Field label="سرپرست کار">
            <input value={f.supervisor} onChange={(e) => set('supervisor', e.target.value)} />
          </Field>
          <Field label="صادرکننده (کارشناس HSE)">
            <input value={f.issuer} onChange={(e) => set('issuer', e.target.value)} />
          </Field>
          <Field label="شروع" required>
            <DateTimeInput value={f.startAt} onChange={(v) => set('startAt', v)} />
          </Field>
          <Field label="پایان" required>
            <DateTimeInput value={f.endAt} min={f.startAt} onChange={(v) => set('endAt', v)} />
          </Field>
        </div>
        <Field label="شرح کار" required>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div>
          <label className="hint">اقدامات احتیاطی (قابل ویرایش)</label>
          {precautions.map((t, i) => (
            <div key={i} className="row" style={{ marginTop: 6 }}>
              <input className="input" style={{ flex: 1 }} value={t} onChange={(e) => setPrecautions(precautions.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn ghost sm" onClick={() => setPrecautions(precautions.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 6 }}>
            <input className="input" style={{ flex: 1 }} value={extra} placeholder="افزودن اقدام جدید…" onChange={(e) => setExtra(e.target.value)} />
            <button type="button" className="btn sm" disabled={!extra.trim()} onClick={() => { setPrecautions([...precautions, extra.trim()]); setExtra('') }}>افزودن</button>
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>صدور مجوز</button>
          <button className="btn" onClick={() => nav('/permits')}>انصراف</button>
        </div>
      </div>
    </div>
  )
}

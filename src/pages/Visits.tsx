import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db, newId } from '../db/db'
import type { Visit, VisitStatus } from '../db/types'
import { VISIT_STATUS_LABEL, criticalityTone } from '../db/types'
import { toJalali, toJalaliLong, todayISO } from '../utils/date'
import { fmtCoord, getCurrentLocation, mapsUrl } from '../utils/geo'
import { downloadCSV } from '../utils/export'
import { deletePhoto } from '../utils/photo'
import { Badge, Confirm, Empty, Field, PageHead, Photo, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { PhotosInput } from '../components/PhotosInput'
import { NcPicker } from '../components/NcPicker'

function useLookups() {
  const contracts = useLiveQuery(() => db.contracts.toArray(), [])
  const domains = useLiveQuery(() => db.domains.toArray(), [])
  const ncs = useLiveQuery(() => db.nonConformances.toArray(), [])
  return {
    contracts,
    domains,
    ncs,
    contract: (id: string) => contracts?.find((c) => c.id === id),
    domainName: (id?: string) => domains?.find((d) => d.id === id)?.name ?? '—',
    nc: (id: string) => ncs?.find((n) => n.id === id),
  }
}

export function VisitList() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const contractId = params.get('contract') ?? ''
  const status = (params.get('status') ?? 'all') as VisitStatus | 'all'
  const L = useLookups()
  const list = useLiveQuery(async () => {
    let rows = await db.visits.orderBy('date').reverse().toArray()
    if (contractId) rows = rows.filter((v) => v.contractId === contractId)
    if (status !== 'all') rows = rows.filter((v) => v.status === status)
    return rows
  }, [contractId, status])

  function setParam(k: string, v: string) {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }
  function exportCsv() {
    if (!list?.length) return
    const rows: (string | number | undefined)[][] = []
    for (const v of list) {
      const c = L.contract(v.contractId)
      const base = [toJalali(v.date), v.time, c?.name, L.domainName(c?.domainId), c?.contractor, v.inspector, v.locationText, fmtCoord(v.lat), fmtCoord(v.lng), VISIT_STATUS_LABEL[v.status], v.followUpDate ? toJalali(v.followUpDate) : '', v.resolvedDate ? toJalali(v.resolvedDate) : '']
      if (v.items.length === 0) rows.push([...base, '', '', '', '', '', v.description])
      for (const it of v.items) {
        const n = L.nc(it.ncId)
        rows.push([...base, n?.code, n?.title, n?.criticality, n?.score, it.note, v.description])
      }
    }
    downloadCSV(
      `visits-${todayISO()}.csv`,
      ['تاریخ', 'ساعت', 'پیمان', 'حوزه', 'پیمانکار', 'کارشناس', 'محل', 'عرض جغرافیایی', 'طول جغرافیایی', 'وضعیت', 'تاریخ پیگیری', 'تاریخ رفع', 'شناسه عدم انطباق', 'عنوان عدم انطباق', 'درجه بحرانیت', 'ضریب', 'توضیح مورد', 'شرح بازدید'],
      rows,
    )
  }

  return (
    <div>
      <PageHead
        title="بازدیدها"
        sub="بازدیدهای HSE از پیمان‌ها"
        actions={
          <>
            <Link to="/contracts" className="btn sm">پیمان‌ها</Link>
            <Link to="/reports" className="btn sm">گزارش</Link>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => nav(`/visits/new${contractId ? `?contract=${contractId}` : ''}`)}><IconPlus /> بازدید جدید</button>
          </>
        }
      />
      <div className="toolbar">
        <select className="input" value={contractId} onChange={(e) => setParam('contract', e.target.value)}>
          <option value="">همه پیمان‌ها</option>
          {L.contracts?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value === 'all' ? '' : e.target.value)}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="open">باز</option>
          <option value="resolved">رفع شده</option>
        </select>
      </div>
      {list && list.length === 0 && (
        <Empty text="بازدیدی ثبت نشده است.">
          {L.contracts && L.contracts.length === 0 ? (
            <Link to="/contracts" className="btn primary">ابتدا یک پیمان تعریف کنید</Link>
          ) : (
            <button className="btn primary" onClick={() => nav('/visits/new')}>ثبت اولین بازدید</button>
          )}
        </Empty>
      )}
      <div className="stack">
        {list?.map((v) => {
          const c = L.contract(v.contractId)
          const maxScore = Math.max(0, ...v.items.map((it) => L.nc(it.ncId)?.score ?? 0))
          return (
            <Link key={v.id} to={`/visits/${v.id}`} className="card clickable" style={{ color: 'inherit' }}>
              <div className="card-title">
                <h3>{c?.name ?? 'پیمان حذف‌شده'}</h3>
                <div className="row">
                  {v.items.length > 0 ? <Badge tone={criticalityTone(maxScore)}>{v.items.length} عدم انطباق</Badge> : <Badge tone="ok">بدون عدم انطباق</Badge>}
                  <Badge tone={v.status === 'resolved' ? 'ok' : 'warn'}>{VISIT_STATUS_LABEL[v.status]}</Badge>
                </div>
              </div>
              <div className="meta">
                <span>{toJalali(v.date)}{v.time ? ` ${v.time}` : ''}</span>
                {v.locationText && <span>{v.locationText}</span>}
                {v.lat !== undefined && <span>📍 موقعیت ثبت شده</span>}
                {(v.beforePhotoIds.length > 0 || v.afterPhotoIds.length > 0) && <span>📷 {v.beforePhotoIds.length} قبل / {v.afterPhotoIds.length} بعد</span>}
              </div>
            </Link>
          )
        })}
      </div>
      <button className="fab" aria-label="بازدید جدید" onClick={() => nav('/visits/new')}><IconPlus /></button>
    </div>
  )
}

export function VisitDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const v = useLiveQuery(() => (id ? db.visits.get(id) : undefined), [id])
  const L = useLookups()
  const [confirm, setConfirm] = useState(false)
  if (v === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!v) return <Empty text="بازدید پیدا نشد" />
  const c = L.contract(v.contractId)

  async function remove() {
    for (const p of [...v!.beforePhotoIds, ...v!.afterPhotoIds]) await deletePhoto(p)
    await db.visits.delete(v!.id)
    toast('حذف شد')
    nav('/visits', { replace: true })
  }
  async function toggleStatus() {
    const resolved = v!.status !== 'resolved'
    await db.visits.update(v!.id, { status: resolved ? 'resolved' : 'open', resolvedDate: resolved ? todayISO() : undefined })
    toast(resolved ? 'به‌عنوان رفع‌شده ثبت شد' : 'دوباره باز شد')
  }

  return (
    <div className="print-area">
      <PageHead
        title={c?.name ?? 'بازدید'}
        sub={`${toJalaliLong(v.date)}${v.time ? ' · ' + v.time : ''}${v.inspector ? ' · ' + v.inspector : ''}`}
        back="/visits"
        actions={
          <span className="no-print row">
            <button className="btn sm" onClick={() => window.print()}>چاپ / PDF</button>
            <button className="btn sm" onClick={() => nav(`/visits/${v.id}/edit`)}>ویرایش</button>
            <button className="btn sm danger" onClick={() => setConfirm(true)}><IconTrash /></button>
          </span>
        }
      />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <Badge tone={v.status === 'resolved' ? 'ok' : 'warn'}>{VISIT_STATUS_LABEL[v.status]}</Badge>
          <Badge tone="primary">{L.domainName(c?.domainId)}</Badge>
        </div>
        <dl className="kv">
          {c?.contractor && <><dt>پیمانکار</dt><dd>{c.contractor}</dd></>}
          {c?.employer && <><dt>کارفرما</dt><dd>{c.employer}</dd></>}
          {v.locationText && <><dt>محل</dt><dd>{v.locationText}</dd></>}
          {v.lat !== undefined && v.lng !== undefined && (
            <>
              <dt>موقعیت</dt>
              <dd>
                <span dir="ltr">{fmtCoord(v.lat)}, {fmtCoord(v.lng)}</span>
                {v.accuracy ? <span className="text-muted text-sm"> (دقت ~{v.accuracy} متر)</span> : null}
                {' '}<a href={mapsUrl(v.lat, v.lng)} target="_blank" rel="noreferrer" className="no-print">نمایش روی نقشه</a>
              </dd>
            </>
          )}
          {v.description && <><dt>شرح بازدید</dt><dd className="pre">{v.description}</dd></>}
          {v.followUpDate && <><dt>تاریخ پیگیری</dt><dd>{toJalali(v.followUpDate)}</dd></>}
          {v.resolvedDate && <><dt>تاریخ رفع</dt><dd>{toJalali(v.resolvedDate)}</dd></>}
        </dl>
      </div>

      <div className="section-title"><h2>موارد عدم انطباق ({v.items.length})</h2></div>
      <div className="card">
        {v.items.length === 0 && <p className="text-muted text-sm">عدم انطباقی ثبت نشده است.</p>}
        {v.items.map((it, i) => {
          const n = L.nc(it.ncId)
          return (
            <div key={it.ncId} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="body">
                <div className="title">{i + 1}. <code className="code">{n?.code ?? '?'}</code> {n?.title ?? 'مورد حذف‌شده از کاتالوگ'}</div>
                <div className="meta">
                  {n?.criticality && <Badge tone={criticalityTone(n.score)}>{n.criticality}</Badge>}
                  {n?.process && <span>{n.process}</span>}
                  {n?.deadline && <span>مهلت: {n.deadline}</span>}
                </div>
                {it.note && <div className="text-sm mt">توضیح: {it.note}</div>}
                {n?.correctiveAction && <div className="text-sm text-muted mt">اقدام اصلاحی: {n.correctiveAction}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {(v.beforePhotoIds.length > 0 || v.afterPhotoIds.length > 0) && (
        <div className="grid-2 mt">
          <div className="card">
            <h3>عکس‌های قبل ({v.beforePhotoIds.length})</h3>
            <div className="photo-grid print mt">{v.beforePhotoIds.map((p) => <Photo key={p} id={p} thumb />)}</div>
          </div>
          <div className="card">
            <h3>عکس‌های بعد ({v.afterPhotoIds.length})</h3>
            {v.afterPhotoIds.length === 0 && <p className="text-muted text-sm">هنوز عکس بعد از رفع ثبت نشده است.</p>}
            <div className="photo-grid print mt">{v.afterPhotoIds.map((p) => <Photo key={p} id={p} thumb />)}</div>
          </div>
        </div>
      )}

      <div className="form-actions no-print">
        <button className="btn primary" onClick={toggleStatus}>{v.status === 'resolved' ? 'باز کردن مجدد' : 'ثبت رفع عدم انطباق‌ها'}</button>
        {v.status !== 'resolved' && <button className="btn" onClick={() => nav(`/visits/${v.id}/edit#after`)}>افزودن عکس بعد</button>}
      </div>
      <Confirm open={confirm} text="این بازدید و عکس‌های آن حذف شوند؟" onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  )
}

export function VisitForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const existing = useLiveQuery(() => (id ? db.visits.get(id) : undefined), [id])
  if (id && existing === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (id && !existing) return <Empty text="بازدید پیدا نشد" />
  return <VisitEditor key={id ?? 'new'} existing={existing} presetContract={params.get('contract') ?? undefined} onDone={(vid) => nav(`/visits/${vid}`, { replace: true })} />
}

function VisitEditor({ existing, presetContract, onDone }: { existing?: Visit; presetContract?: string; onDone: (id: string) => void }) {
  const nav = useNavigate()
  const contracts = useLiveQuery(() => db.contracts.filter((c) => c.active || c.id === existing?.contractId).toArray(), [existing?.contractId])
  const domains = useLiveQuery(() => db.domains.toArray(), [])
  const [f, setF] = useState<Omit<Visit, 'id' | 'createdAt'>>({
    contractId: existing?.contractId ?? presetContract ?? '',
    date: existing?.date ?? todayISO(),
    time: existing?.time ?? new Date().toTimeString().slice(0, 5),
    inspector: existing?.inspector ?? localStorage.getItem('hse.inspector') ?? '',
    locationText: existing?.locationText ?? '',
    lat: existing?.lat,
    lng: existing?.lng,
    accuracy: existing?.accuracy,
    items: existing?.items ?? [],
    description: existing?.description ?? '',
    beforePhotoIds: existing?.beforePhotoIds ?? [],
    afterPhotoIds: existing?.afterPhotoIds ?? [],
    status: existing?.status ?? 'open',
    followUpDate: existing?.followUpDate ?? '',
    resolvedDate: existing?.resolvedDate,
  })
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState('')
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const contractId = f.contractId || contracts?.[0]?.id || ''
  const contract = contracts?.find((c) => c.id === contractId)

  async function locate() {
    setGeoBusy(true)
    setGeoErr('')
    try {
      const g = await getCurrentLocation()
      setF((p) => ({ ...p, lat: g.lat, lng: g.lng, accuracy: g.accuracy }))
      toast('موقعیت ثبت شد')
    } catch (e) {
      setGeoErr(e instanceof Error ? e.message : 'خطا')
    } finally {
      setGeoBusy(false)
    }
  }
  async function save() {
    if (!contractId) return setErr('پیمان را انتخاب کنید')
    if (!f.date) return setErr('تاریخ را وارد کنید')
    const vid = existing?.id ?? newId()
    const data = { ...f, contractId, inspector: f.inspector.trim() }
    if (f.inspector.trim()) localStorage.setItem('hse.inspector', f.inspector.trim())
    if (existing) await db.visits.update(vid, data)
    else await db.visits.add({ ...data, id: vid, createdAt: Date.now() })
    toast('بازدید ذخیره شد')
    onDone(vid)
  }

  return (
    <div>
      <PageHead title={existing ? 'ویرایش بازدید' : 'ثبت بازدید'} back />
      {contracts && contracts.length === 0 && (
        <Empty text="هیچ پیمان فعالی تعریف نشده است.">
          <Link to="/contracts" className="btn primary">تعریف پیمان</Link>
        </Empty>
      )}
      {contracts && contracts.length > 0 && (
        <div className="stack">
          <div className="card stack">
            <Field label="پیمان" required hint={contract ? `حوزه: ${domains?.find((d) => d.id === contract.domainId)?.name ?? '—'}${contract.contractor ? ' · پیمانکار: ' + contract.contractor : ''}` : undefined}>
              <select value={contractId} onChange={(e) => { set('contractId', e.target.value); set('items', []) }}>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="تاریخ" required><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
              <Field label="ساعت"><input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></Field>
              <Field label="کارشناس"><input value={f.inspector} onChange={(e) => set('inspector', e.target.value)} /></Field>
              <Field label="محل / نام بوستان / آدرس"><input value={f.locationText} onChange={(e) => set('locationText', e.target.value)} placeholder="مثلاً بوستان لاله، ضلع شمالی" /></Field>
            </div>
            <div className="field">
              <label>موقعیت جغرافیایی</label>
              <div className="geo-box">
                <button type="button" className="btn sm" onClick={locate} disabled={geoBusy}>{geoBusy ? 'در حال دریافت…' : '📍 ثبت موقعیت فعلی'}</button>
                {f.lat !== undefined && f.lng !== undefined ? (
                  <span className="text-sm">
                    <span dir="ltr">{fmtCoord(f.lat)}, {fmtCoord(f.lng)}</span>
                    {f.accuracy ? <span className="text-muted"> (±{f.accuracy} متر)</span> : null}
                    {' '}<a href={mapsUrl(f.lat, f.lng)} target="_blank" rel="noreferrer">نقشه</a>
                    {' '}<button type="button" className="btn ghost sm" onClick={() => setF((p) => ({ ...p, lat: undefined, lng: undefined, accuracy: undefined }))}>حذف</button>
                  </span>
                ) : (
                  <span className="hint">هنوز ثبت نشده</span>
                )}
              </div>
              {geoErr && <span className="error">{geoErr}</span>}
            </div>
          </div>

          <div className="card stack">
            <h3>موارد عدم انطباق</h3>
            <NcPicker domainId={contract?.domainId} value={f.items} onChange={(items) => set('items', items)} />
          </div>

          <div className="card stack">
            <Field label="شرح بازدید / توضیحات"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <PhotosInput label="عکس‌های قبل (وضعیت مشاهده‌شده)" value={f.beforePhotoIds} onChange={(ids) => set('beforePhotoIds', ids)} />
            <div id="after">
              <PhotosInput label="عکس‌های بعد (پس از رفع)" value={f.afterPhotoIds} onChange={(ids) => set('afterPhotoIds', ids)} />
            </div>
            <div className="grid-2">
              <Field label="تاریخ پیگیری"><input type="date" value={f.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} /></Field>
              <Field label="وضعیت">
                <select value={f.status} onChange={(e) => set('status', e.target.value as VisitStatus)}>
                  <option value="open">باز</option>
                  <option value="resolved">رفع شده</option>
                </select>
              </Field>
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          <div className="form-actions">
            <button className="btn primary" onClick={save}>ذخیره بازدید</button>
            <button className="btn" onClick={() => nav(-1)}>انصراف</button>
          </div>
        </div>
      )}
    </div>
  )
}

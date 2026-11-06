import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CHECKLIST_TEMPLATES } from '../data/templates'
import { db, newId } from '../db/db'
import type { CheckResult, ChecklistItem, Finding, Inspection, InspectionStatus, Severity } from '../db/types'
import { INSPECTION_STATUS_LABEL, SEVERITY_LABEL, criticalityTone } from '../db/types'
import { toJalali, toJalaliLong, todayISO } from '../utils/date'
import { fmtCoord, getCurrentLocation, mapsUrl } from '../utils/geo'
import { downloadCSV } from '../utils/export'
import { deletePhoto } from '../utils/photo'
import { Badge, Confirm, Empty, Field, Modal, PageHead, Photo, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { PhotoInput } from '../components/PhotoInput'
import { PhotosInput } from '../components/PhotosInput'
import { NcPicker } from '../components/NcPicker'
import { DateInput } from '../components/DateInput'

function summarize(items: ChecklistItem[]) {
  const ok = items.filter((i) => i.result === 'ok').length
  const nok = items.filter((i) => i.result === 'nok').length
  const na = items.filter((i) => i.result === 'na').length
  return { ok, nok, na, answered: ok + nok + na, total: items.length }
}

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

// ---------- فهرست ----------

export function InspectionList() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const contractId = params.get('contract') ?? ''
  const status = (params.get('status') ?? 'all') as InspectionStatus | 'all'
  const L = useLookups()
  const list = useLiveQuery(async () => {
    let rows = await db.inspections.orderBy('date').reverse().toArray()
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
      const s = summarize(v.items)
      const base = [toJalali(v.date), v.time, c?.name ?? '', L.domainName(c?.domainId), c?.contractor, v.inspector, v.locationText, fmtCoord(v.lat), fmtCoord(v.lng), v.templateName ?? '', s.ok, s.nok, s.na, INSPECTION_STATUS_LABEL[v.status], v.followUpDate ? toJalali(v.followUpDate) : '', v.resolvedDate ? toJalali(v.resolvedDate) : '']
      if (v.ncItems.length === 0) rows.push([...base, '', '', '', '', '', v.description])
      for (const it of v.ncItems) {
        const n = L.nc(it.ncId)
        rows.push([...base, n?.code, n?.title, n?.criticality, n?.score, it.note, v.description])
      }
    }
    downloadCSV(
      `inspections-${todayISO()}.csv`,
      ['تاریخ', 'ساعت', 'پیمان', 'حوزه', 'پیمانکار', 'کارشناس', 'محل', 'عرض جغرافیایی', 'طول جغرافیایی', 'چک‌لیست', 'مطابق', 'نامطابق', 'نامرتبط', 'وضعیت', 'تاریخ پیگیری', 'تاریخ رفع', 'شناسه عدم انطباق', 'عنوان عدم انطباق', 'درجه بحرانیت', 'ضریب', 'توضیح مورد', 'شرح بازرسی'],
      rows,
    )
  }

  return (
    <div>
      <PageHead
        title="بازرسی‌ها"
        sub="بازدیدهای HSE از پیمان‌ها"
        actions={
          <>
            <Link to="/contracts" className="btn sm">پیمان‌ها</Link>
            <Link to="/findings" className="btn sm">شرایط ناایمن</Link>
            <Link to="/reports" className="btn sm">گزارش</Link>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => nav(`/inspections/new${contractId ? `?contract=${contractId}` : ''}`)}><IconPlus /> بازرسی جدید</button>
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
        <Empty text="بازرسی ثبت نشده است.">
          {L.contracts && L.contracts.length === 0 ? (
            <Link to="/contracts" className="btn primary">ابتدا یک پیمان تعریف کنید</Link>
          ) : (
            <button className="btn primary" onClick={() => nav('/inspections/new')}>ثبت اولین بازرسی</button>
          )}
        </Empty>
      )}
      <div className="stack">
        {list?.map((v) => {
          const c = L.contract(v.contractId)
          const s = summarize(v.items)
          const maxScore = Math.max(0, ...v.ncItems.map((it) => L.nc(it.ncId)?.score ?? 0))
          return (
            <Link key={v.id} to={`/inspections/${v.id}`} className="card clickable" style={{ color: 'inherit' }}>
              <div className="card-title">
                <h3>{c?.name ?? v.templateName ?? 'بازرسی'}</h3>
                <div className="row">
                  {v.ncItems.length > 0 ? <Badge tone={criticalityTone(maxScore)}>{v.ncItems.length} عدم انطباق</Badge> : s.nok > 0 ? <Badge tone="danger">{s.nok} نامطابق</Badge> : <Badge tone="ok">بدون عدم انطباق</Badge>}
                  <Badge tone={v.status === 'resolved' ? 'ok' : 'warn'}>{INSPECTION_STATUS_LABEL[v.status]}</Badge>
                </div>
              </div>
              <div className="meta">
                <span>{toJalali(v.date)}{v.time ? ` ${v.time}` : ''}</span>
                {v.locationText && <span>{v.locationText}</span>}
                {v.templateName && <span>{v.templateName} ({s.answered}/{s.total})</span>}
                {v.lat !== undefined && <span>📍</span>}
                {(v.beforePhotoIds.length > 0 || v.afterPhotoIds.length > 0) && <span>📷 {v.beforePhotoIds.length} قبل / {v.afterPhotoIds.length} بعد</span>}
              </div>
            </Link>
          )
        })}
      </div>
      <button className="fab" aria-label="بازرسی جدید" onClick={() => nav('/inspections/new')}><IconPlus /></button>
    </div>
  )
}

// ---------- فرم ----------

export function InspectionForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const existing = useLiveQuery(() => (id ? db.inspections.get(id) : undefined), [id])
  if (id && existing === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (id && !existing) return <Empty text="بازرسی پیدا نشد" />
  return <InspectionEditor key={id ?? 'new'} existing={existing} presetContract={params.get('contract') ?? undefined} onDone={(vid) => nav(`/inspections/${vid}`, { replace: true })} />
}

function InspectionEditor({ existing, presetContract, onDone }: { existing?: Inspection; presetContract?: string; onDone: (id: string) => void }) {
  const nav = useNavigate()
  const contracts = useLiveQuery(() => db.contracts.filter((c) => c.active || c.id === existing?.contractId).toArray(), [existing?.contractId])
  const domains = useLiveQuery(() => db.domains.toArray(), [])
  const [f, setF] = useState<Omit<Inspection, 'id' | 'createdAt' | 'items'>>({
    contractId: existing?.contractId ?? presetContract ?? '',
    date: existing?.date ?? todayISO(),
    time: existing?.time ?? new Date().toTimeString().slice(0, 5),
    inspector: existing?.inspector ?? localStorage.getItem('hse.inspector') ?? '',
    locationText: existing?.locationText ?? '',
    lat: existing?.lat,
    lng: existing?.lng,
    accuracy: existing?.accuracy,
    templateId: existing?.templateId,
    templateName: existing?.templateName,
    ncItems: existing?.ncItems ?? [],
    description: existing?.description ?? '',
    beforePhotoIds: existing?.beforePhotoIds ?? [],
    afterPhotoIds: existing?.afterPhotoIds ?? [],
    status: existing?.status ?? 'open',
    followUpDate: existing?.followUpDate ?? '',
    resolvedDate: existing?.resolvedDate,
    notes: existing?.notes,
  })
  const [templateId, setTemplateId] = useState(existing?.templateId ?? '')
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
    if (f.inspector.trim()) localStorage.setItem('hse.inspector', f.inspector.trim())
    const data = { ...f, contractId, inspector: f.inspector.trim() }
    if (existing) {
      // تغییر چک‌لیست فقط وقتی هنوز آیتمی پاسخ داده نشده
      let items = existing.items
      if (templateId !== (existing.templateId ?? '') && summarize(existing.items).answered === 0) {
        const tpl = CHECKLIST_TEMPLATES.find((t) => t.id === templateId)
        items = tpl ? tpl.items.map((text) => ({ id: newId(), text, result: '' as CheckResult })) : []
        data.templateId = tpl?.id
        data.templateName = tpl?.name
      }
      await db.inspections.update(vid, { ...data, items })
    } else {
      const tpl = CHECKLIST_TEMPLATES.find((t) => t.id === templateId)
      await db.inspections.add({
        ...data,
        id: vid,
        templateId: tpl?.id,
        templateName: tpl?.name,
        items: tpl ? tpl.items.map((text) => ({ id: newId(), text, result: '' })) : [],
        createdAt: Date.now(),
      })
    }
    toast('بازرسی ذخیره شد')
    onDone(vid)
  }

  return (
    <div>
      <PageHead title={existing ? 'ویرایش بازرسی' : 'ثبت بازرسی'} back />
      {contracts && contracts.length === 0 && (
        <Empty text="هیچ پیمان فعالی تعریف نشده است.">
          <Link to="/contracts" className="btn primary">تعریف پیمان</Link>
        </Empty>
      )}
      {contracts && contracts.length > 0 && (
        <div className="stack">
          <div className="card stack">
            <Field label="پیمان" required hint={contract ? `حوزه: ${domains?.find((d) => d.id === contract.domainId)?.name ?? '—'}${contract.contractor ? ' · پیمانکار: ' + contract.contractor : ''}` : undefined}>
              <select value={contractId} onChange={(e) => { set('contractId', e.target.value); set('ncItems', []) }}>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="تاریخ" required><DateInput value={f.date} onChange={(d) => set('date', d)} /></Field>
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
            <Field label="چک‌لیست (اختیاری)" hint={existing && summarize(existing.items).answered > 0 ? 'چون آیتم‌هایی پاسخ داده شده، چک‌لیست قابل تغییر نیست' : 'آیتم‌های چک‌لیست در صفحه بازرسی پاسخ داده می‌شوند'}>
              <select value={templateId} disabled={!!existing && summarize(existing.items).answered > 0} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">بدون چک‌لیست</option>
                {CHECKLIST_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length} آیتم)</option>)}
              </select>
            </Field>
          </div>

          <div className="card stack">
            <h3>موارد عدم انطباق</h3>
            <NcPicker domainId={contract?.domainId} value={f.ncItems} onChange={(items) => set('ncItems', items)} />
          </div>

          <div className="card stack">
            <Field label="شرح بازرسی / توضیحات"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <PhotosInput label="عکس‌های قبل (وضعیت مشاهده‌شده)" value={f.beforePhotoIds} onChange={(ids) => set('beforePhotoIds', ids)} />
            <div id="after">
              <PhotosInput label="عکس‌های بعد (پس از رفع)" value={f.afterPhotoIds} onChange={(ids) => set('afterPhotoIds', ids)} />
            </div>
            <div className="grid-2">
              <Field label="تاریخ پیگیری"><DateInput value={f.followUpDate ?? ''} onChange={(d) => set('followUpDate', d)} /></Field>
              <Field label="وضعیت">
                <select value={f.status} onChange={(e) => set('status', e.target.value as InspectionStatus)}>
                  <option value="open">باز</option>
                  <option value="resolved">رفع شده</option>
                </select>
              </Field>
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          <div className="form-actions">
            <button className="btn primary" onClick={save}>ذخیره بازرسی</button>
            <button className="btn" onClick={() => nav(-1)}>انصراف</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- جزئیات ----------

export function InspectionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const insp = useLiveQuery(() => (id ? db.inspections.get(id) : undefined), [id])
  const findings = useLiveQuery(() => (id ? db.findings.where('inspectionId').equals(id).toArray() : []), [id])
  const L = useLookups()
  const [confirm, setConfirm] = useState(false)
  const [findingFor, setFindingFor] = useState<ChecklistItem | null>(null)

  if (insp === undefined) return <p className="text-muted">در حال بارگذاری…</p>
  if (!insp) return <Empty text="بازرسی پیدا نشد" />
  const c = L.contract(insp.contractId)
  const s = summarize(insp.items)

  async function setResult(item: ChecklistItem, result: CheckResult) {
    if (!insp) return
    const items = insp.items.map((i) => (i.id === item.id ? { ...i, result } : i))
    await db.inspections.update(insp.id, { items })
    if (result === 'nok' && !findings?.some((f) => f.description.startsWith(item.text))) setFindingFor({ ...item, result })
  }
  async function setNote(item: ChecklistItem, note: string) {
    if (!insp) return
    await db.inspections.update(insp.id, { items: insp.items.map((i) => (i.id === item.id ? { ...i, note } : i)) })
  }
  async function remove() {
    for (const p of [...insp!.beforePhotoIds, ...insp!.afterPhotoIds]) await deletePhoto(p)
    await db.inspections.delete(insp!.id)
    toast('بازرسی حذف شد')
    nav('/inspections', { replace: true })
  }
  async function toggleStatus() {
    const resolved = insp!.status !== 'resolved'
    await db.inspections.update(insp!.id, { status: resolved ? 'resolved' : 'open', resolvedDate: resolved ? todayISO() : undefined })
    toast(resolved ? 'به‌عنوان رفع‌شده ثبت شد' : 'دوباره باز شد')
  }

  return (
    <div className="print-area">
      <PageHead
        title={c?.name ?? insp.templateName ?? 'بازرسی'}
        sub={`${toJalaliLong(insp.date)}${insp.time ? ' · ' + insp.time : ''}${insp.inspector ? ' · ' + insp.inspector : ''}`}
        back="/inspections"
        actions={
          <span className="no-print row">
            <button className="btn sm" onClick={() => window.print()}>چاپ / PDF</button>
            <button className="btn sm" onClick={() => nav(`/inspections/${insp.id}/edit`)}>ویرایش</button>
            <button className="btn sm danger" onClick={() => setConfirm(true)}><IconTrash /></button>
          </span>
        }
      />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <Badge tone={insp.status === 'resolved' ? 'ok' : 'warn'}>{INSPECTION_STATUS_LABEL[insp.status]}</Badge>
          {c && <Badge tone="primary">{L.domainName(c.domainId)}</Badge>}
        </div>
        <dl className="kv">
          {c?.contractor && <><dt>پیمانکار</dt><dd>{c.contractor}</dd></>}
          {c?.employer && <><dt>کارفرما</dt><dd>{c.employer}</dd></>}
          {insp.locationText && <><dt>محل</dt><dd>{insp.locationText}</dd></>}
          {insp.lat !== undefined && insp.lng !== undefined && (
            <>
              <dt>موقعیت</dt>
              <dd>
                <span dir="ltr">{fmtCoord(insp.lat)}, {fmtCoord(insp.lng)}</span>
                {insp.accuracy ? <span className="text-muted text-sm"> (دقت ~{insp.accuracy} متر)</span> : null}
                {' '}<a href={mapsUrl(insp.lat, insp.lng)} target="_blank" rel="noreferrer" className="no-print">نمایش روی نقشه</a>
              </dd>
            </>
          )}
          {insp.description && <><dt>شرح بازرسی</dt><dd className="pre">{insp.description}</dd></>}
          {insp.followUpDate && <><dt>تاریخ پیگیری</dt><dd>{toJalali(insp.followUpDate)}</dd></>}
          {insp.resolvedDate && <><dt>تاریخ رفع</dt><dd>{toJalali(insp.resolvedDate)}</dd></>}
        </dl>
      </div>

      <div className="section-title"><h2>موارد عدم انطباق ({insp.ncItems.length})</h2></div>
      <div className="card">
        {insp.ncItems.length === 0 && <p className="text-muted text-sm">عدم انطباقی ثبت نشده است. <Link to={`/inspections/${insp.id}/edit`} className="no-print">افزودن</Link></p>}
        {insp.ncItems.map((it, i) => {
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

      {insp.items.length > 0 && (
        <>
          <div className="section-title">
            <h2>چک‌لیست: {insp.templateName}</h2>
            <span className="row text-sm">
              <Badge tone="ok">{s.ok} مطابق</Badge>
              <Badge tone="danger">{s.nok} نامطابق</Badge>
              <Badge>{s.na} نامرتبط</Badge>
            </span>
          </div>
          <div className="card">
            <div className="progress" style={{ marginBottom: 8 }}><div style={{ width: `${(s.answered / s.total) * 100}%` }} /></div>
            {insp.items.map((item, idx) => (
              <div key={item.id} className="check-item">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="text">{idx + 1}. {item.text}</span>
                  <div className="seg no-print">
                    <button className={`ok ${item.result === 'ok' ? 'active' : ''}`} onClick={() => setResult(item, 'ok')}>مطابق</button>
                    <button className={`nok ${item.result === 'nok' ? 'active' : ''}`} onClick={() => setResult(item, 'nok')}>نامطابق</button>
                    <button className={`na ${item.result === 'na' ? 'active' : ''}`} onClick={() => setResult(item, 'na')}>N/A</button>
                  </div>
                </div>
                {(item.result === 'nok' || item.note) && (
                  <input className="input" placeholder="توضیح مغایرت…" defaultValue={item.note ?? ''} onBlur={(e) => e.target.value !== (item.note ?? '') && setNote(item, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {(insp.beforePhotoIds.length > 0 || insp.afterPhotoIds.length > 0) && (
        <div className="grid-2 mt">
          <div className="card">
            <h3>عکس‌های قبل ({insp.beforePhotoIds.length})</h3>
            <div className="photo-grid print mt">{insp.beforePhotoIds.map((p) => <Photo key={p} id={p} thumb />)}</div>
          </div>
          <div className="card">
            <h3>عکس‌های بعد ({insp.afterPhotoIds.length})</h3>
            {insp.afterPhotoIds.length === 0 && <p className="text-muted text-sm">هنوز عکس بعد از رفع ثبت نشده است.</p>}
            <div className="photo-grid print mt">{insp.afterPhotoIds.map((p) => <Photo key={p} id={p} thumb />)}</div>
          </div>
        </div>
      )}

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

      <div className="form-actions no-print">
        <button className="btn primary" onClick={toggleStatus}>{insp.status === 'resolved' ? 'باز کردن مجدد' : 'ثبت رفع عدم انطباق‌ها'}</button>
        {insp.status !== 'resolved' && <button className="btn" onClick={() => nav(`/inspections/${insp.id}/edit#after`)}>افزودن عکس بعد</button>}
      </div>

      <Confirm open={confirm} text="این بازرسی و عکس‌های آن حذف شوند؟ (شرایط ناایمن ثبت‌شده حذف نمی‌شوند)" onCancel={() => setConfirm(false)} onConfirm={remove} />
      <FindingModal
        open={!!findingFor}
        onClose={() => setFindingFor(null)}
        initial={findingFor ? { description: findingFor.text, location: insp.locationText ?? c?.name ?? '', date: insp.date, inspectionId: insp.id } : undefined}
      />
    </div>
  )
}

// ---------- فرم شرایط ناایمن ----------

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
    if (existing) await db.findings.update(existing.id, f)
    else await db.findings.add({ ...f, id: newId(), createdAt: Date.now() })
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
          <Field label="تاریخ مشاهده" required><DateInput value={f.date} onChange={(d) => set('date', d)} /></Field>
          <Field label="محل" required><input value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
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
          <Field label="مسئول رفع"><input value={f.responsible} onChange={(e) => set('responsible', e.target.value)} /></Field>
          <Field label="مهلت رفع"><DateInput value={f.dueDate ?? ''} onChange={(d) => set('dueDate', d)} /></Field>
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

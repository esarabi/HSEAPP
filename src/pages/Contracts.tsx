import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, newId } from '../db/db'
import type { Contract } from '../db/types'
import { toJalali } from '../utils/date'
import { Badge, Confirm, Empty, Field, Modal, PageHead, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { DateInput } from '../components/DateInput'

export function ContractList() {
  const [editing, setEditing] = useState<Contract | null | 'new'>(null)
  const [del, setDel] = useState<Contract | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const contracts = useLiveQuery(() => db.contracts.orderBy('name').toArray(), [])
  const domains = useLiveQuery(() => db.domains.toArray(), [])
  const visitCounts = useLiveQuery(async () => {
    const out: Record<string, number> = {}
    await db.inspections.each((v) => { out[v.contractId] = (out[v.contractId] ?? 0) + 1 })
    return out
  }, [])
  const domainName = (id: string) => domains?.find((d) => d.id === id)?.name ?? '—'
  const list = contracts?.filter((c) => showInactive || c.active)

  async function remove() {
    if (!del) return
    const n = await db.inspections.where('contractId').equals(del.id).count()
    if (n > 0) {
      toast(`این پیمان ${n} بازرسی دارد؛ به‌جای حذف، آن را غیرفعال کنید`)
      setDel(null)
      return
    }
    await db.contracts.delete(del.id)
    setDel(null)
    toast('حذف شد')
  }

  return (
    <div>
      <PageHead
        title="پیمان‌ها"
        sub="پیمان‌هایی که بازرسی HSE آن‌ها بر عهده شماست"
        actions={
          <>
            <Link to="/catalog" className="btn sm">کاتالوگ عدم انطباق</Link>
            <button className="btn primary sm" onClick={() => setEditing('new')}><IconPlus /> پیمان جدید</button>
          </>
        }
      />
      <label className="check text-sm" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> نمایش پیمان‌های غیرفعال
      </label>
      {list && list.length === 0 && (
        <Empty text="هنوز پیمانی تعریف نشده است. برای ثبت بازدید ابتدا یک پیمان بسازید.">
          <button className="btn primary" onClick={() => setEditing('new')}>افزودن پیمان</button>
        </Empty>
      )}
      <div className="stack">
        {list?.map((c) => (
          <div key={c.id} className="card">
            <div className="card-title">
              <h3>{c.name}</h3>
              <div className="row">
                <Badge tone="primary">{domainName(c.domainId)}</Badge>
                {!c.active && <Badge>غیرفعال</Badge>}
              </div>
            </div>
            <div className="meta">
              {c.contractor && <span>پیمانکار: {c.contractor}</span>}
              {c.employer && <span>کارفرما: {c.employer}</span>}
              {c.area && <span>{c.area}</span>}
              {c.endDate && <span>تا {toJalali(c.endDate)}</span>}
              <span>{visitCounts?.[c.id] ?? 0} بازرسی</span>
            </div>
            <div className="row mt">
              <Link to={`/inspections?contract=${c.id}`} className="btn sm">بازرسی‌ها</Link>
              <Link to={`/inspections/new?contract=${c.id}`} className="btn sm primary">بازرسی جدید</Link>
              <button className="btn sm" onClick={() => setEditing(c)}>ویرایش</button>
              <button className="btn sm danger" onClick={() => setDel(c)}><IconTrash /></button>
            </div>
          </div>
        ))}
      </div>
      <button className="fab" aria-label="پیمان جدید" onClick={() => setEditing('new')}><IconPlus /></button>
      {editing && <ContractForm key={editing === 'new' ? 'new' : editing.id} existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <Confirm open={!!del} text="این پیمان حذف شود؟" onCancel={() => setDel(null)} onConfirm={remove} />
    </div>
  )
}

export function ContractForm({ existing, onClose }: { existing?: Contract; onClose: () => void }) {
  const domains = useLiveQuery(() => db.domains.orderBy('createdAt').toArray(), [])
  const [f, setF] = useState<Omit<Contract, 'id' | 'createdAt'>>({
    name: existing?.name ?? '',
    domainId: existing?.domainId ?? '',
    contractor: existing?.contractor ?? '',
    employer: existing?.employer ?? '',
    area: existing?.area ?? '',
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    notes: existing?.notes ?? '',
    active: existing?.active ?? true,
  })
  const [newDomain, setNewDomain] = useState('')
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const domainId = f.domainId || domains?.[0]?.id || ''

  async function addDomain() {
    const name = newDomain.trim()
    if (!name) return
    const id = newId()
    await db.domains.add({ id, name, createdAt: Date.now() })
    set('domainId', id)
    setNewDomain('')
  }
  async function save() {
    if (!f.name.trim()) return setErr('نام پیمان را وارد کنید')
    if (!domainId) return setErr('حوزه را انتخاب کنید')
    const data = { ...f, name: f.name.trim(), domainId }
    if (existing) await db.contracts.update(existing.id, data)
    else await db.contracts.add({ ...data, id: newId(), createdAt: Date.now() })
    toast('ذخیره شد')
    onClose()
  }

  return (
    <Modal open title={existing ? 'ویرایش پیمان' : 'پیمان جدید'} onClose={onClose}>
      <div className="stack">
        <Field label="نام پیمان" required>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="مثلاً نگهداشت فضای سبز ناحیه ۳" />
        </Field>
        <Field label="حوزه" required hint="کاتالوگ عدم انطباق بر اساس حوزه انتخاب می‌شود">
          <select value={domainId} onChange={(e) => set('domainId', e.target.value)}>
            {domains?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <div className="row">
          <input className="input" style={{ flex: 1 }} placeholder="حوزه جدید…" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <button type="button" className="btn sm" disabled={!newDomain.trim()} onClick={addDomain}>افزودن حوزه</button>
        </div>
        <div className="grid-2">
          <Field label="پیمانکار"><input value={f.contractor} onChange={(e) => set('contractor', e.target.value)} /></Field>
          <Field label="کارفرما / منطقه"><input value={f.employer} onChange={(e) => set('employer', e.target.value)} /></Field>
          <Field label="محدوده / ناحیه"><input value={f.area} onChange={(e) => set('area', e.target.value)} /></Field>
          <Field label="وضعیت">
            <select value={f.active ? '1' : '0'} onChange={(e) => set('active', e.target.value === '1')}>
              <option value="1">فعال</option>
              <option value="0">غیرفعال</option>
            </select>
          </Field>
          <Field label="شروع"><DateInput value={f.startDate ?? ''} onChange={(d) => set('startDate', d)} /></Field>
          <Field label="پایان"><DateInput value={f.endDate ?? ''} onChange={(d) => set('endDate', d)} /></Field>
        </div>
        <Field label="یادداشت"><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} style={{ minHeight: 60 }} /></Field>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>ذخیره</button>
          <button className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </Modal>
  )
}

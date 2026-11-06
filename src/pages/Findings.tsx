import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import type { Finding } from '../db/types'
import { ACTION_STATUS_LABEL, SEVERITY_LABEL } from '../db/types'
import { toJalali, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, PageHead, Photo, severityTone, statusTone, toast } from '../components/ui'
import { IconPlus, IconTrash } from '../components/Icons'
import { FindingModal } from './Inspections'
import { downloadCSV } from '../utils/export'
import { deletePhoto } from '../utils/photo'

type Filter = 'open' | 'all' | 'done'

export function FindingList() {
  const [filter, setFilter] = useState<Filter>('open')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Finding | null>(null)
  const [creating, setCreating] = useState(false)
  const [del, setDel] = useState<Finding | null>(null)
  const today = todayISO()

  const list = useLiveQuery(async () => {
    let rows = await db.findings.orderBy('date').reverse().toArray()
    if (filter === 'open') rows = rows.filter((r) => r.status !== 'done')
    if (filter === 'done') rows = rows.filter((r) => r.status === 'done')
    if (q.trim()) {
      const s = q.trim()
      rows = rows.filter((r) => r.description.includes(s) || r.location.includes(s) || (r.responsible ?? '').includes(s))
    }
    return rows
  }, [filter, q])

  async function remove() {
    if (!del) return
    await deletePhoto(del.photoId)
    await db.findings.delete(del.id)
    setDel(null)
    toast('حذف شد')
  }
  async function markDone(f: Finding) {
    await db.findings.update(f.id, { status: 'done' })
    toast('به عنوان رفع‌شده ثبت شد')
  }
  function exportCsv() {
    if (!list?.length) return
    downloadCSV(
      `findings-${todayISO()}.csv`,
      ['تاریخ', 'محل', 'شرح', 'شدت', 'اقدام اصلاحی', 'مسئول', 'مهلت', 'وضعیت'],
      list.map((f) => [toJalali(f.date), f.location, f.description, SEVERITY_LABEL[f.severity], f.correctiveAction, f.responsible, f.dueDate ? toJalali(f.dueDate) : '', ACTION_STATUS_LABEL[f.status]]),
    )
  }

  return (
    <div>
      <PageHead
        title="شرایط ناایمن"
        sub="مشاهدات و اقدامات اصلاحی"
        back="/inspections"
        actions={
          <>
            <button className="btn sm" onClick={exportCsv} disabled={!list?.length}>خروجی CSV</button>
            <button className="btn primary sm" onClick={() => setCreating(true)}><IconPlus /> ثبت مورد</button>
          </>
        }
      />
      <div className="chips">
        {(['open', 'all', 'done'] as Filter[]).map((k) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {k === 'open' ? 'باز' : k === 'done' ? 'رفع‌شده' : 'همه'}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="input" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list && list.length === 0 && <Empty text="موردی یافت نشد." />}
      <div className="stack">
        {list?.map((f) => (
          <div key={f.id} className="card">
            <div className="card-title">
              <h3>{f.description}</h3>
              <Badge tone={severityTone(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
            </div>
            <div className="meta">
              <span>{toJalali(f.date)}</span>
              <span>{f.location}</span>
              {f.responsible && <span>مسئول: {f.responsible}</span>}
              {f.dueDate && <span className={f.status !== 'done' && f.dueDate < today ? 'text-danger' : ''}>مهلت: {toJalali(f.dueDate)}</span>}
              <Badge tone={statusTone(f.status)}>{ACTION_STATUS_LABEL[f.status]}</Badge>
            </div>
            {f.correctiveAction && <p className="text-sm mt">اقدام: {f.correctiveAction}</p>}
            {f.photoId && <div className="mt"><Photo id={f.photoId} thumb /></div>}
            <div className="row mt">
              {f.status !== 'done' && <button className="btn sm" onClick={() => markDone(f)}>رفع شد ✓</button>}
              <button className="btn sm" onClick={() => setEditing(f)}>ویرایش</button>
              <button className="btn sm danger" onClick={() => setDel(f)}><IconTrash /></button>
            </div>
          </div>
        ))}
      </div>
      <button className="fab" aria-label="ثبت مورد" onClick={() => setCreating(true)}><IconPlus /></button>
      <FindingModal open={creating} onClose={() => setCreating(false)} />
      <FindingModal open={!!editing} onClose={() => setEditing(null)} existing={editing ?? undefined} />
      <Confirm open={!!del} text="این مورد حذف شود؟" onCancel={() => setDel(null)} onConfirm={remove} />
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, newId } from '../db/db'
import type { Recurrence, Task, TaskCategory } from '../db/types'
import { RECURRENCE_LABEL, TASK_CATEGORY_LABEL } from '../db/types'
import { addDays, addMonths, relativeDays, toJalali, todayISO } from '../utils/date'
import { Badge, Confirm, Empty, Field, Modal, PageHead, toast } from '../components/ui'
import { DateInput } from '../components/DateInput'
import { IconPlus, IconTrash } from '../components/Icons'

function nextDue(date: string, r: Recurrence): string | null {
  switch (r) {
    case 'daily': return addDays(date, 1)
    case 'weekly': return addDays(date, 7)
    case 'monthly': return addMonths(date, 1)
    case 'quarterly': return addMonths(date, 3)
    case 'yearly': return addMonths(date, 12)
    default: return null
  }
}

type Filter = 'pending' | 'today' | 'overdue' | 'done'

export function TaskList() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [del, setDel] = useState<Task | null>(null)
  const today = todayISO()
  const list = useLiveQuery(async () => {
    const rows = await db.tasks.orderBy('dueDate').toArray()
    if (filter === 'done') return rows.filter((t) => t.done).reverse()
    const pending = rows.filter((t) => !t.done)
    if (filter === 'today') return pending.filter((t) => t.dueDate === today)
    if (filter === 'overdue') return pending.filter((t) => t.dueDate < today)
    return pending
  }, [filter, today])

  async function complete(t: Task) {
    const next = nextDue(t.dueDate, t.recurrence)
    await db.tasks.update(t.id, { done: true, doneAt: Date.now() })
    if (next) {
      // برای وظایف تکرارشونده، نوبت بعدی ساخته می‌شود؛ اگر تاریخ گذشته است تا امروز جلو می‌رود
      let due = next
      while (due < today) due = nextDue(due, t.recurrence) ?? due
      await db.tasks.add({ ...t, id: newId(), dueDate: due, done: false, doneAt: undefined, createdAt: Date.now() })
      toast(`انجام شد؛ نوبت بعدی ${toJalali(due)}`)
    } else toast('انجام شد')
  }
  async function reopen(t: Task) {
    await db.tasks.update(t.id, { done: false, doneAt: undefined })
  }

  const grouped = list?.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.done ? 'done' : t.dueDate < today ? 'overdue' : t.dueDate === today ? 'today' : t.dueDate <= addDays(today, 7) ? 'week' : 'later'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})
  const groupLabel: Record<string, string> = { overdue: 'عقب‌افتاده', today: 'امروز', week: 'این هفته', later: 'بعداً', done: 'انجام‌شده' }

  return (
    <div>
      <PageHead title="وظایف و یادآوری‌ها" actions={<button className="btn primary sm" onClick={() => setEditing('new')}><IconPlus /> وظیفه جدید</button>} />
      <div className="chips">
        {([['pending', 'در انتظار'], ['today', 'امروز'], ['overdue', 'عقب‌افتاده'], ['done', 'انجام‌شده']] as [Filter, string][]).map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {list && list.length === 0 && <Empty text="وظیفه‌ای در این دسته نیست." />}
      {grouped && ['overdue', 'today', 'week', 'later', 'done'].filter((k) => grouped[k]?.length).map((k) => (
        <section key={k}>
          <div className="section-title"><h2 className={k === 'overdue' ? 'text-danger' : ''}>{groupLabel[k]}</h2></div>
          <div className="card">
            {grouped[k].map((t) => (
              <div key={t.id} className={`list-item ${t.done ? 'done' : ''}`}>
                <input type="checkbox" className="check" style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} checked={t.done} onChange={() => (t.done ? reopen(t) : complete(t))} />
                <div className="body">
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    <span>{toJalali(t.dueDate)}</span>
                    {!t.done && <span className={t.dueDate < today ? 'text-danger' : ''}>{relativeDays(t.dueDate)}</span>}
                    <Badge>{TASK_CATEGORY_LABEL[t.category]}</Badge>
                    {t.recurrence !== 'none' && <Badge tone="info">{RECURRENCE_LABEL[t.recurrence]}</Badge>}
                  </div>
                  {t.notes && <div className="text-sm text-muted">{t.notes}</div>}
                </div>
                <button className="btn ghost sm" onClick={() => setEditing(t)}>ویرایش</button>
                <button className="btn ghost sm" onClick={() => setDel(t)}><IconTrash /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <button className="fab" aria-label="وظیفه جدید" onClick={() => setEditing('new')}><IconPlus /></button>
      {editing && <TaskForm key={editing === 'new' ? 'new' : editing.id} existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <Confirm open={!!del} text="این وظیفه حذف شود؟" onCancel={() => setDel(null)} onConfirm={async () => { await db.tasks.delete(del!.id); setDel(null) }} />
    </div>
  )
}

function TaskForm({ existing, onClose }: { existing?: Task; onClose: () => void }) {
  const [f, setF] = useState<Omit<Task, 'id' | 'createdAt' | 'done' | 'doneAt'>>({
    title: existing?.title ?? '',
    category: existing?.category ?? 'inspection',
    dueDate: existing?.dueDate ?? todayISO(),
    recurrence: existing?.recurrence ?? 'none',
    notes: existing?.notes ?? '',
  })
  const [err, setErr] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  async function save() {
    if (!f.title.trim()) return setErr('عنوان را وارد کنید')
    if (!f.dueDate) return setErr('تاریخ سررسید را وارد کنید')
    if (existing) await db.tasks.update(existing.id, f)
    else await db.tasks.add({ ...f, id: newId(), done: false, createdAt: Date.now() })
    toast('ذخیره شد')
    onClose()
  }
  return (
    <Modal open title={existing ? 'ویرایش وظیفه' : 'وظیفه جدید'} onClose={onClose}>
      <div className="stack">
        <Field label="عنوان" required>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً بازرسی ماهانه کپسول‌ها" />
        </Field>
        <div className="grid-2">
          <Field label="دسته">
            <select value={f.category} onChange={(e) => set('category', e.target.value as TaskCategory)}>
              {(Object.keys(TASK_CATEGORY_LABEL) as TaskCategory[]).map((c) => <option key={c} value={c}>{TASK_CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="سررسید" required><DateInput value={f.dueDate} onChange={(d) => set('dueDate', d)} /></Field>
          <Field label="تکرار" hint="با انجام هر نوبت، نوبت بعدی خودکار ساخته می‌شود">
            <select value={f.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
              {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="یادداشت"><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button className="btn primary" onClick={save}>ذخیره</button>
          <button className="btn" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </Modal>
  )
}

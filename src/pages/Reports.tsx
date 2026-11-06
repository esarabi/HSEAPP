import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { CRITICALITY_LEVELS, criticalityTone } from '../db/types'
import { addDays, toJalali, todayISO } from '../utils/date'
import { downloadCSV } from '../utils/export'
import { Badge, Field, PageHead } from '../components/ui'

const TONE_COLOR: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', info: 'var(--info)' }

export function Reports() {
  const [contractId, setContractId] = useState('')
  const [from, setFrom] = useState(addDays(todayISO(), -30))
  const [to, setTo] = useState(todayISO())
  const contracts = useLiveQuery(() => db.contracts.toArray(), [])
  const domains = useLiveQuery(() => db.domains.toArray(), [])
  const ncs = useLiveQuery(() => db.nonConformances.toArray(), [])
  const visits = useLiveQuery(async () => {
    let rows = await db.visits.where('date').between(from, to, true, true).toArray()
    if (contractId) rows = rows.filter((v) => v.contractId === contractId)
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [contractId, from, to])

  const stats = useMemo(() => {
    if (!visits || !ncs) return null
    const ncMap = new Map(ncs.map((n) => [n.id, n]))
    const byLevel = new Map<number, number>()
    const byNc = new Map<string, number>()
    const byProcess = new Map<string, number>()
    const byContract = new Map<string, { visits: number; items: number; weighted: number }>()
    let items = 0
    let weighted = 0
    for (const v of visits) {
      const bc = byContract.get(v.contractId) ?? { visits: 0, items: 0, weighted: 0 }
      bc.visits++
      for (const it of v.items) {
        const n = ncMap.get(it.ncId)
        items++
        bc.items++
        const s = n?.score ?? 0
        weighted += s
        bc.weighted += s
        byLevel.set(s, (byLevel.get(s) ?? 0) + 1)
        byNc.set(it.ncId, (byNc.get(it.ncId) ?? 0) + 1)
        const p = n?.process ?? 'سایر'
        byProcess.set(p, (byProcess.get(p) ?? 0) + 1)
      }
      byContract.set(v.contractId, bc)
    }
    const top = [...byNc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ nc: ncMap.get(id), n }))
    const proc = [...byProcess.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    return { items, weighted, byLevel, top, proc, byContract, open: visits.filter((v) => v.status === 'open').length, resolved: visits.filter((v) => v.status === 'resolved').length }
  }, [visits, ncs])

  function exportCsv() {
    if (!visits?.length || !ncs) return
    const ncMap = new Map(ncs.map((n) => [n.id, n]))
    const rows: (string | number | undefined)[][] = []
    for (const v of visits) {
      const c = contracts?.find((x) => x.id === v.contractId)
      for (const it of v.items) {
        const n = ncMap.get(it.ncId)
        rows.push([toJalali(v.date), c?.name, c?.contractor, v.locationText, n?.code, n?.title, n?.questionType, n?.process, n?.criticality, n?.score, n?.deadline, it.note, v.status === 'resolved' ? 'رفع شده' : 'باز'])
      }
    }
    downloadCSV(`report-${from}-${to}.csv`, ['تاریخ', 'پیمان', 'پیمانکار', 'محل', 'شناسه', 'عنوان', 'نوع', 'فرآیند', 'درجه بحرانیت', 'ضریب', 'مهلت', 'توضیح', 'وضعیت'], rows)
  }
  const maxLevel = Math.max(1, ...[...(stats?.byLevel.values() ?? [])])

  return (
    <div className="print-area">
      <PageHead
        title="گزارش بازدیدها"
        back="/visits"
        actions={
          <span className="no-print row">
            <button className="btn sm" onClick={exportCsv} disabled={!visits?.length}>خروجی CSV</button>
            <button className="btn sm" onClick={() => window.print()}>چاپ / PDF</button>
          </span>
        }
      />
      <div className="card no-print">
        <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <Field label="پیمان">
            <select value={contractId} onChange={(e) => setContractId(e.target.value)}>
              <option value="">همه پیمان‌ها</option>
              {contracts?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="از تاریخ"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="تا تاریخ"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </div>
      <p className="text-sm text-muted mt">بازه {toJalali(from)} تا {toJalali(to)}{contractId ? ` · ${contracts?.find((c) => c.id === contractId)?.name}` : ''}</p>

      <div className="stats mt">
        <div className="stat"><div className="label">تعداد بازدید</div><div className="value">{visits?.length ?? 0}</div></div>
        <div className="stat warn"><div className="label">عدم انطباق ثبت‌شده</div><div className="value">{stats?.items ?? 0}</div></div>
        <div className="stat danger"><div className="label">مجموع امتیاز منفی</div><div className="value">{stats?.weighted ?? 0}</div></div>
        <div className="stat ok"><div className="label">بازدید رفع‌شده</div><div className="value">{stats?.resolved ?? 0} / {visits?.length ?? 0}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>توزیع بر اساس درجه بحرانیت</h3>
          <div className="stack mt" style={{ gap: 6 }}>
            {[...CRITICALITY_LEVELS].reverse().map((l) => {
              const n = stats?.byLevel.get(l.score) ?? 0
              return (
                <div key={l.score} className="bar">
                  <span style={{ width: 120 }}>{l.label}</span>
                  <div className="track"><div className="fill" style={{ width: `${(n / maxLevel) * 100}%`, background: TONE_COLOR[criticalityTone(l.score)] }} /></div>
                  <span style={{ width: 28, textAlign: 'left' }}>{n}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <h3>بر اساس فرآیند / محل</h3>
          {!stats?.proc.length && <p className="text-muted text-sm mt">داده‌ای نیست.</p>}
          <div className="stack mt" style={{ gap: 6 }}>
            {stats?.proc.map(([p, n]) => (
              <div key={p} className="bar">
                <span style={{ width: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                <div className="track"><div className="fill" style={{ width: `${(n / (stats.proc[0]?.[1] ?? 1)) * 100}%`, background: 'var(--primary)' }} /></div>
                <span style={{ width: 28, textAlign: 'left' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title"><h2>پرتکرارترین عدم انطباق‌ها</h2></div>
      <div className="card">
        {!stats?.top.length && <p className="text-muted text-sm">داده‌ای نیست.</p>}
        {stats?.top.map(({ nc, n }, i) => (
          <div key={nc?.id ?? i} className="list-item">
            <div className="body">
              <div className="title"><code className="code">{nc?.code}</code> {nc?.title ?? 'مورد حذف‌شده'}</div>
              <div className="meta">{nc?.criticality && <Badge tone={criticalityTone(nc.score)}>{nc.criticality}</Badge>}{nc?.process && <span>{nc.process}</span>}</div>
            </div>
            <strong>{n} بار</strong>
          </div>
        ))}
      </div>

      {!contractId && stats && stats.byContract.size > 0 && (
        <>
          <div className="section-title"><h2>به تفکیک پیمان</h2></div>
          <div className="card">
            {[...stats.byContract.entries()].map(([cid, s]) => {
              const c = contracts?.find((x) => x.id === cid)
              return (
                <div key={cid} className="list-item">
                  <div className="body">
                    <div className="title">{c?.name ?? '—'}</div>
                    <div className="meta">{c?.contractor && <span>{c.contractor}</span>}<span>{domains?.find((d) => d.id === c?.domainId)?.name}</span></div>
                  </div>
                  <span className="text-sm">{s.visits} بازدید · {s.items} مورد · امتیاز {s.weighted}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-title"><h2>فهرست بازدیدها</h2></div>
      <div className="card">
        {!visits?.length && <p className="text-muted text-sm">بازدیدی در این بازه نیست.</p>}
        {visits?.map((v) => {
          const c = contracts?.find((x) => x.id === v.contractId)
          return (
            <Link key={v.id} to={`/visits/${v.id}`} className="list-item" style={{ color: 'inherit' }}>
              <div className="body">
                <div className="title">{toJalali(v.date)} — {c?.name}</div>
                <div className="meta">{v.locationText && <span>{v.locationText}</span>}<span>{v.items.length} عدم انطباق</span></div>
              </div>
              <Badge tone={v.status === 'resolved' ? 'ok' : 'warn'}>{v.status === 'resolved' ? 'رفع شده' : 'باز'}</Badge>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

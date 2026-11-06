import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { INCIDENT_TYPE_LABEL, PERMIT_TYPE_LABEL, SEVERITY_LABEL } from '../db/types'
import { addDays, daysUntil, relativeDays, todayISO, toJalali, toJalaliLong } from '../utils/date'
import { Badge, severityTone } from '../components/ui'

export function Dashboard() {
  const today = todayISO()
  const in30 = addDays(today, 30)
  const in7 = addDays(today, 7)

  const openFindings = useLiveQuery(() => db.findings.where('status').notEqual('done').toArray(), [])
  const openIncidents = useLiveQuery(() => db.incidents.where('status').notEqual('done').toArray(), [])
  const activePermits = useLiveQuery(() => db.permits.where('status').equals('active').toArray(), [])
  const dueTasks = useLiveQuery(
    () => db.tasks.filter((t) => !t.done && t.dueDate <= in7).sortBy('dueDate'),
    [in7],
  )
  const expiringTrainings = useLiveQuery(
    () => db.trainings.filter((t) => !!t.expiryDate && t.expiryDate <= in30).sortBy('expiryDate'),
    [in30],
  )
  const expiringMedical = useLiveQuery(
    () => db.persons.filter((p) => !!p.medicalExamExpiry && p.medicalExamExpiry <= in30).sortBy('medicalExamExpiry'),
    [in30],
  )
  const persons = useLiveQuery(() => db.persons.toArray(), [])
  const personName = (id: string) => persons?.find((p) => p.id === id)?.name ?? '—'

  const overdueFindings = openFindings?.filter((f) => f.dueDate && f.dueDate < today).length ?? 0
  const overdueTasks = dueTasks?.filter((t) => t.dueDate < today).length ?? 0
  const recentIncidents = useLiveQuery(() => db.incidents.orderBy('date').reverse().limit(5).toArray(), [])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>سلام 👋</h1>
          <div className="sub">{toJalaliLong(new Date())}</div>
        </div>
      </div>

      <div className="stats">
        <Link to="/findings" className={`stat ${overdueFindings ? 'danger' : ''}`}>
          <div className="label">شرایط ناایمن باز</div>
          <div className="value">{openFindings?.length ?? 0}</div>
          {overdueFindings > 0 && <div className="text-sm text-danger">{overdueFindings} مورد سررسید گذشته</div>}
        </Link>
        <Link to="/incidents" className="stat warn">
          <div className="label">حوادث در پیگیری</div>
          <div className="value">{openIncidents?.length ?? 0}</div>
        </Link>
        <Link to="/permits" className="stat ok">
          <div className="label">مجوز کار فعال</div>
          <div className="value">{activePermits?.length ?? 0}</div>
        </Link>
        <Link to="/tasks" className={`stat ${overdueTasks ? 'danger' : ''}`}>
          <div className="label">وظایف این هفته</div>
          <div className="value">{dueTasks?.length ?? 0}</div>
          {overdueTasks > 0 && <div className="text-sm text-danger">{overdueTasks} مورد عقب‌افتاده</div>}
        </Link>
      </div>

      <div className="grid-2">
        <section>
          <div className="section-title">
            <h2>وظایف پیش رو</h2>
            <Link to="/tasks" className="text-sm">همه</Link>
          </div>
          <div className="card">
            {!dueTasks?.length && <p className="text-muted text-sm">وظیفه‌ای برای ۷ روز آینده ثبت نشده است.</p>}
            {dueTasks?.map((t) => (
              <div key={t.id} className="list-item">
                <div className="body">
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    <span>{toJalali(t.dueDate)}</span>
                    <span className={t.dueDate < today ? 'text-danger' : ''}>{relativeDays(t.dueDate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>مجوزهای کار فعال</h2>
            <Link to="/permits" className="text-sm">همه</Link>
          </div>
          <div className="card">
            {!activePermits?.length && <p className="text-muted text-sm">مجوز فعالی وجود ندارد.</p>}
            {activePermits?.map((p) => {
              const expired = new Date(p.endAt).getTime() < Date.now()
              return (
                <Link key={p.id} to={`/permits/${p.id}`} className="list-item" style={{ color: 'inherit' }}>
                  <div className="body">
                    <div className="title">{PERMIT_TYPE_LABEL[p.type]} — {p.location}</div>
                    <div className="meta"><span>شماره {p.number}</span><span>{p.contractor}</span></div>
                  </div>
                  {expired ? <Badge tone="danger">منقضی</Badge> : <Badge tone="ok">فعال</Badge>}
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>شرایط ناایمن باز</h2>
            <Link to="/findings" className="text-sm">همه</Link>
          </div>
          <div className="card">
            {!openFindings?.length && <p className="text-muted text-sm">مورد بازی وجود ندارد. 👍</p>}
            {openFindings?.slice(0, 5).map((f) => (
              <div key={f.id} className="list-item">
                <div className="body">
                  <div className="title">{f.description}</div>
                  <div className="meta">
                    <span>{f.location}</span>
                    {f.dueDate && <span className={f.dueDate < today ? 'text-danger' : ''}>مهلت: {toJalali(f.dueDate)}</span>}
                  </div>
                </div>
                <Badge tone={severityTone(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>هشدارهای انقضا (۳۰ روز)</h2>
            <Link to="/people" className="text-sm">پرسنل</Link>
          </div>
          <div className="card">
            {!expiringTrainings?.length && !expiringMedical?.length && (
              <p className="text-muted text-sm">آموزش یا معاینه‌ای در حال انقضا نیست.</p>
            )}
            {expiringMedical?.map((p) => (
              <Link key={p.id} to={`/people/${p.id}`} className="list-item" style={{ color: 'inherit' }}>
                <div className="body">
                  <div className="title">معاینه دوره‌ای: {p.name}</div>
                  <div className="meta"><span>{toJalali(p.medicalExamExpiry)}</span></div>
                </div>
                <Badge tone={(daysUntil(p.medicalExamExpiry) ?? 0) < 0 ? 'danger' : 'warn'}>{relativeDays(p.medicalExamExpiry)}</Badge>
              </Link>
            ))}
            {expiringTrainings?.map((t) => (
              <Link key={t.id} to={`/people/${t.personId}`} className="list-item" style={{ color: 'inherit' }}>
                <div className="body">
                  <div className="title">{t.course}: {personName(t.personId)}</div>
                  <div className="meta"><span>{toJalali(t.expiryDate)}</span></div>
                </div>
                <Badge tone={(daysUntil(t.expiryDate) ?? 0) < 0 ? 'danger' : 'warn'}>{relativeDays(t.expiryDate)}</Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="section-title">
        <h2>آخرین حوادث</h2>
        <Link to="/incidents" className="text-sm">همه</Link>
      </div>
      <div className="card">
        {!recentIncidents?.length && <p className="text-muted text-sm">حادثه‌ای ثبت نشده است.</p>}
        {recentIncidents?.map((i) => (
          <Link key={i.id} to={`/incidents/${i.id}`} className="list-item" style={{ color: 'inherit' }}>
            <div className="body">
              <div className="title">{i.title}</div>
              <div className="meta"><span>{INCIDENT_TYPE_LABEL[i.type]}</span><span>{toJalali(i.date)}</span><span>{i.location}</span></div>
            </div>
            <Badge tone={severityTone(i.severity)}>{SEVERITY_LABEL[i.severity]}</Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}

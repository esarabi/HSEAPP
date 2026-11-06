import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, TABLE_NAMES } from '../db/db'
import { Confirm, Field, PageHead, toast } from '../components/ui'
import { IconDownload, IconUpload } from '../components/Icons'
import { downloadFile, exportBackup, importBackup } from '../utils/export'
import { todayISO } from '../utils/date'

type Theme = 'auto' | 'light' | 'dark'

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

export function Settings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('hse.theme') as Theme) ?? 'auto')
  const [inspector, setInspector] = useState(() => localStorage.getItem('hse.inspector') ?? '')
  const [wipe, setWipe] = useState(false)
  const [pendingImport, setPendingImport] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  const counts = useLiveQuery(async () => {
    const out: Record<string, number> = {}
    for (const n of TABLE_NAMES) out[n] = await db.table(n).count()
    out.photos = await db.photos.count()
    return out
  }, [])

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  function changeTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('hse.theme', t)
    applyTheme(t)
  }

  async function doExport() {
    setBusy(true)
    try {
      const b = await exportBackup()
      downloadFile(`hse-backup-${todayISO()}.json`, JSON.stringify(b), 'application/json')
      toast('فایل پشتیبان دانلود شد')
    } finally {
      setBusy(false)
    }
  }
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      setPendingImport(JSON.parse(await f.text()))
    } catch {
      toast('فایل قابل خواندن نیست')
    }
  }
  async function doImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return
    setBusy(true)
    try {
      const n = await importBackup(pendingImport, mode)
      toast(`${n} رکورد بازیابی شد`)
      setPendingImport(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'خطا در بازیابی')
    } finally {
      setBusy(false)
    }
  }
  async function wipeAll() {
    await db.delete()
    setWipe(false)
    location.reload()
  }

  const labels: Record<string, string> = {
    inspections: 'بازرسی', findings: 'شرایط ناایمن', incidents: 'حادثه', permits: 'مجوز کار', persons: 'نفر', trainings: 'سابقه آموزشی', tasks: 'وظیفه', photos: 'عکس',
  }

  return (
    <div>
      <PageHead title="تنظیمات" />
      <div className="stack">
        {installEvt && (
          <div className="card">
            <h3>نصب برنامه</h3>
            <p className="text-sm text-muted">برای دسترسی سریع‌تر و استفاده آفلاین، برنامه را روی صفحه اصلی نصب کنید.</p>
            <button className="btn primary mt" onClick={async () => { await installEvt.prompt(); setInstallEvt(null) }}>نصب روی دستگاه</button>
          </div>
        )}
        <div className="card stack">
          <h3>عمومی</h3>
          <Field label="نام کارشناس (پیش‌فرض فرم‌ها)">
            <input value={inspector} onChange={(e) => { setInspector(e.target.value); localStorage.setItem('hse.inspector', e.target.value) }} />
          </Field>
          <Field label="پوسته">
            <select value={theme} onChange={(e) => changeTheme(e.target.value as Theme)}>
              <option value="auto">خودکار (سیستم)</option>
              <option value="light">روشن</option>
              <option value="dark">تیره</option>
            </select>
          </Field>
        </div>

        <div className="card stack">
          <h3>پشتیبان‌گیری و بازیابی</h3>
          <p className="text-sm text-muted">
            همه داده‌ها فقط روی همین دستگاه ذخیره می‌شوند. برای جلوگیری از ازدست‌رفتن اطلاعات، به‌صورت دوره‌ای فایل پشتیبان بگیرید و برای انتقال به دستگاه دیگر از آن استفاده کنید.
          </p>
          <div className="row">
            <button className="btn primary" onClick={doExport} disabled={busy}><IconDownload /> دریافت فایل پشتیبان</button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><IconUpload /> بازیابی از فایل</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickFile} />
          </div>
          {counts && (
            <div className="row text-sm text-muted">
              {Object.entries(counts).map(([k, v]) => <span key={k}>{v} {labels[k]}</span>)}
            </div>
          )}
        </div>

        <div className="card stack">
          <h3 className="text-danger">حذف همه داده‌ها</h3>
          <p className="text-sm text-muted">همه اطلاعات این دستگاه پاک می‌شود. قبل از آن پشتیبان بگیرید.</p>
          <div><button className="btn danger" onClick={() => setWipe(true)}>پاک کردن همه داده‌ها</button></div>
        </div>

        <p className="text-sm text-muted" style={{ textAlign: 'center' }}>دستیار HSE · نسخه {__APP_VERSION__}</p>
      </div>

      <Confirm open={wipe} text="همه داده‌ها به‌صورت دائمی حذف شوند؟" onCancel={() => setWipe(false)} onConfirm={wipeAll} />
      {pendingImport !== null && (
        <div className="overlay" onClick={() => setPendingImport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>بازیابی داده‌ها</h2>
            <p className="mt">داده‌های فایل چگونه اعمال شود؟</p>
            <div className="form-actions">
              <button className="btn primary" disabled={busy} onClick={() => doImport('merge')}>ادغام با داده‌های فعلی</button>
              <button className="btn danger" disabled={busy} onClick={() => doImport('replace')}>جایگزینی کامل</button>
              <button className="btn" onClick={() => setPendingImport(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

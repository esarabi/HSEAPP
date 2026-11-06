import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { IconBack, IconInbox } from './Icons'

export function PageHead({ title, sub, back, actions }: { title: string; sub?: string; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="page-head">
      <div className="row" style={{ gap: 6 }}>
        {back && (
          <button className="btn ghost sm" aria-label="بازگشت" onClick={() => (back === true ? nav(-1) : nav(back))}>
            <IconBack />
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'info' | 'primary'; children: ReactNode }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <IconInbox />
      <p>{text}</p>
      {children && <div className="mt">{children}</div>}
    </div>
  )
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ marginBottom: 12 }}>
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, text, onCancel, onConfirm }: { open: boolean; text: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title="تأیید" onClose={onCancel}>
      <p>{text}</p>
      <div className="form-actions">
        <button className="btn danger" onClick={onConfirm}>حذف</button>
        <button className="btn" onClick={onCancel}>انصراف</button>
      </div>
    </Modal>
  )
}

/** نمایش یک عکس ذخیره‌شده در IndexedDB */
export function Photo({ id, thumb }: { id?: string; thumb?: boolean }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!id) return
    let objectUrl: string | undefined
    db.photos.get(id).then((p) => {
      if (p) {
        objectUrl = URL.createObjectURL(p.blob)
        setUrl(objectUrl)
      }
    })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])
  if (!id || !url) return null
  return <img src={url} alt="پیوست" className={thumb ? 'photo-thumb' : 'photo-preview'} />
}

let toastTimer: number | undefined
let setToastFn: ((m: string | null) => void) | null = null
export function toast(message: string) {
  setToastFn?.(message)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => setToastFn?.(null), 2500)
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    setToastFn = setMsg
    return () => {
      setToastFn = null
    }
  }, [])
  return msg ? <div className="toast">{msg}</div> : null
}

export function severityTone(s: string): 'ok' | 'warn' | 'danger' | 'info' {
  if (s === 'critical' || s === 'high') return 'danger'
  if (s === 'medium') return 'warn'
  return 'ok'
}

export function statusTone(s: string): 'ok' | 'warn' | 'danger' | 'info' | 'primary' {
  if (s === 'done' || s === 'closed') return 'ok'
  if (s === 'in_progress') return 'info'
  if (s === 'cancelled') return 'danger'
  return 'warn'
}

import { useEffect, useMemo, useState } from 'react'
import { formatJalali, isoToJalali, JALALI_MONTHS, JALALI_WEEKDAYS, jalaliMonthLength, jalaliToISO, jalaliWeekday, parseJalaliInput } from '../utils/jalali'
import { todayISO } from '../utils/date'

interface Props {
  value: string // ISO YYYY-MM-DD یا ''
  onChange: (iso: string) => void
  placeholder?: string
  min?: string
  max?: string
  required?: boolean
  id?: string
}

/** ورودی تاریخ شمسی: تایپ مستقیم (1404/08/15) یا انتخاب از تقویم */
export function DateInput({ value, onChange, placeholder = '۱۴۰۴/۰۸/۱۵', min, max, id }: Props) {
  const [text, setText] = useState(formatJalali(value))
  const [open, setOpen] = useState(false)
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setText(formatJalali(value))
  }

  function commit() {
    if (!text.trim()) return onChange('')
    const iso = parseJalaliInput(text)
    if (iso) onChange(iso)
    else setText(formatJalali(value))
  }

  return (
    <div className="date-input">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        className="input"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
      />
      <button type="button" className="btn ghost sm date-btn" aria-label="انتخاب از تقویم" onClick={() => setOpen(true)}>
        📅
      </button>
      {open && <Calendar value={value} min={min} max={max} onPick={(iso) => { onChange(iso); setOpen(false) }} onClose={() => setOpen(false)} />}
    </div>
  )
}

function Calendar({ value, min, max, onPick, onClose }: { value: string; min?: string; max?: string; onPick: (iso: string) => void; onClose: () => void }) {
  const today = todayISO()
  const start = isoToJalali(value || today) ?? isoToJalali(today)!
  const [jy, setJy] = useState(start.jy)
  const [jm, setJm] = useState(start.jm)
  const [yearPick, setYearPick] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const days = useMemo(() => {
    const len = jalaliMonthLength(jy, jm)
    const firstIso = jalaliToISO(jy, jm, 1)
    const offset = jalaliWeekday(firstIso)
    const cells: (string | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= len; d++) cells.push(jalaliToISO(jy, jm, d))
    return cells
  }, [jy, jm])

  function prev() {
    if (jm === 1) { setJm(12); setJy(jy - 1) } else setJm(jm - 1)
  }
  function next() {
    if (jm === 12) { setJm(1); setJy(jy + 1) } else setJm(jm + 1)
  }
  const disabled = (iso: string) => (!!min && iso < min) || (!!max && iso > max)
  const years = Array.from({ length: 41 }, (_, i) => jy - 20 + i)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cal-head">
          <button type="button" className="btn ghost sm" onClick={next} aria-label="ماه بعد">‹</button>
          <button type="button" className="btn ghost" onClick={() => setYearPick(!yearPick)}>
            {JALALI_MONTHS[jm - 1]} {jy}
          </button>
          <button type="button" className="btn ghost sm" onClick={prev} aria-label="ماه قبل">›</button>
        </div>
        {yearPick ? (
          <div className="cal-years">
            {years.map((y) => (
              <button type="button" key={y} className={`chip ${y === jy ? 'active' : ''}`} onClick={() => { setJy(y); setYearPick(false) }}>{y}</button>
            ))}
          </div>
        ) : (
          <>
            <div className="cal-grid cal-weekdays">
              {JALALI_WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="cal-grid">
              {days.map((iso, i) =>
                iso ? (
                  <button
                    type="button"
                    key={iso}
                    disabled={disabled(iso)}
                    className={`cal-day ${iso === value ? 'selected' : ''} ${iso === today ? 'today' : ''} ${i % 7 === 6 ? 'friday' : ''}`}
                    onClick={() => onPick(iso)}
                  >
                    {isoToJalali(iso)!.jd}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          </>
        )}
        <div className="form-actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn sm" onClick={() => onPick(today)}>امروز</button>
          <button type="button" className="btn sm" onClick={() => onPick('')}>پاک کردن</button>
          <button type="button" className="btn sm ghost" onClick={onClose}>بستن</button>
        </div>
      </div>
    </div>
  )
}

/** تاریخ شمسی + ساعت؛ مقدار به‌صورت YYYY-MM-DDTHH:mm */
export function DateTimeInput({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  const date = value.slice(0, 10)
  const time = value.length >= 16 ? value.slice(11, 16) : ''
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <div style={{ flex: 1 }}>
        <DateInput value={date} min={min?.slice(0, 10)} onChange={(d) => onChange(d ? `${d}T${time || '08:00'}` : '')} />
      </div>
      <input type="time" className="input" style={{ width: 110, flexShrink: 0 }} value={time} onChange={(e) => onChange(date ? `${date}T${e.target.value}` : '')} />
    </div>
  )
}

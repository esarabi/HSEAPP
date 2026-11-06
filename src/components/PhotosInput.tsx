import { useRef } from 'react'
import { IconCamera } from './Icons'
import { Photo } from './ui'
import { deletePhoto, savePhoto } from '../utils/photo'

/** چند عکس با امکان افزودن و حذف تک‌تک */
export function PhotosInput({ label, value, onChange }: { label: string; value: string[]; onChange: (ids: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const ids: string[] = []
    for (const f of files) ids.push(await savePhoto(f))
    onChange([...value, ...ids])
  }
  async function remove(id: string) {
    await deletePhoto(id)
    onChange(value.filter((x) => x !== id))
  }
  return (
    <div className="field">
      <label>{label}</label>
      {value.length > 0 && (
        <div className="photo-grid">
          {value.map((id) => (
            <div key={id} className="photo-cell">
              <Photo id={id} thumb />
              <button type="button" className="photo-remove" aria-label="حذف عکس" onClick={() => remove(id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden onChange={pick} />
        <button type="button" className="btn sm" onClick={() => ref.current?.click()}>
          <IconCamera /> افزودن عکس
        </button>
      </div>
    </div>
  )
}

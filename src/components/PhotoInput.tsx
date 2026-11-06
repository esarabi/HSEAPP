import { useRef } from 'react'
import { IconCamera, IconTrash } from './Icons'
import { Photo } from './ui'
import { deletePhoto, savePhoto } from '../utils/photo'

export function PhotoInput({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    await deletePhoto(value)
    const id = await savePhoto(f)
    onChange(id)
    e.target.value = ''
  }
  async function remove() {
    await deletePhoto(value)
    onChange(undefined)
  }
  return (
    <div className="field">
      <label>عکس</label>
      {value && <Photo id={value} />}
      <div className="row">
        <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <button type="button" className="btn sm" onClick={() => ref.current?.click()}>
          <IconCamera /> {value ? 'تعویض عکس' : 'افزودن عکس'}
        </button>
        {value && (
          <button type="button" className="btn sm danger" onClick={remove}>
            <IconTrash /> حذف
          </button>
        )}
      </div>
    </div>
  )
}

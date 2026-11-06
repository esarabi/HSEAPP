import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="update-bar">
      <span>نسخه جدید برنامه آماده است.</span>
      <button onClick={() => updateServiceWorker(true)}>به‌روزرسانی</button>
      <button onClick={() => setNeedRefresh(false)} style={{ background: 'transparent', color: '#fff' }}>بعداً</button>
    </div>
  )
}

import { NavLink, Outlet } from 'react-router-dom'
import { IconAlert, IconClipboard, IconContract, IconHome, IconList, IconMore, IconPermit, IconReport, IconSettings, IconTasks, IconUsers, IconVisit } from './Icons'
import { ToastHost } from './ui'
import { UpdatePrompt } from './UpdatePrompt'

export const LINKS = [
  { to: '/', label: 'خانه', icon: IconHome, end: true },
  { to: '/visits', label: 'بازدید', icon: IconVisit },
  { to: '/contracts', label: 'پیمان‌ها', icon: IconContract },
  { to: '/catalog', label: 'عدم انطباق‌ها', icon: IconList },
  { to: '/reports', label: 'گزارش', icon: IconReport },
  { to: '/inspections', label: 'بازرسی', icon: IconClipboard },
  { to: '/incidents', label: 'حوادث', icon: IconAlert },
  { to: '/permits', label: 'مجوز کار', icon: IconPermit },
  { to: '/people', label: 'پرسنل', icon: IconUsers },
  { to: '/tasks', label: 'وظایف', icon: IconTasks },
  { to: '/settings', label: 'تنظیمات', icon: IconSettings },
]

const MOBILE_MAIN = ['/', '/visits', '/inspections', '/tasks']
export const MORE_LINKS = LINKS.filter((l) => !MOBILE_MAIN.includes(l.to))
const mobileLinks = [...LINKS.filter((l) => MOBILE_MAIN.includes(l.to)), { to: '/more', label: 'بیشتر', icon: IconMore, end: false }]

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icons/icon-192.png" alt="" />
          <div>
            <strong>دستیار HSE</strong>
            <small>مدیریت کارهای کارشناس ایمنی</small>
          </div>
        </div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <l.icon /> {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {mobileLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <l.icon /> {l.label}
          </NavLink>
        ))}
      </nav>
      <ToastHost />
      <UpdatePrompt />
    </div>
  )
}

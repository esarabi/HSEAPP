import { NavLink, Outlet } from 'react-router-dom'
import { IconAlert, IconClipboard, IconHome, IconPermit, IconSettings, IconTasks, IconUsers } from './Icons'
import { ToastHost } from './ui'
import { UpdatePrompt } from './UpdatePrompt'

const links = [
  { to: '/', label: 'خانه', icon: IconHome, end: true },
  { to: '/inspections', label: 'بازرسی', icon: IconClipboard },
  { to: '/incidents', label: 'حوادث', icon: IconAlert },
  { to: '/permits', label: 'مجوز کار', icon: IconPermit },
  { to: '/people', label: 'پرسنل', icon: IconUsers },
  { to: '/tasks', label: 'وظایف', icon: IconTasks },
  { to: '/settings', label: 'تنظیمات', icon: IconSettings },
]

const mobileLinks = links.filter((l) => l.to !== '/people')

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
        {links.map((l) => (
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

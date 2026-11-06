import { NavLink } from 'react-router-dom'
import { MORE_LINKS } from '../components/Layout'
import { PageHead } from '../components/ui'

export function More() {
  return (
    <div>
      <PageHead title="بیشتر" />
      <div className="more-grid">
        {MORE_LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className="nav-link">
            <l.icon /> {l.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

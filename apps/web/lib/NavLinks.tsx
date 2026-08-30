'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ALL_LINKS = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'teacher', 'student'] },
  { href: '/students', label: 'Students', roles: ['admin', 'teacher'] },
  { href: '/classes', label: 'Classes', roles: ['admin', 'teacher'] },
  { href: '/attendance', label: 'Attendance', roles: ['admin', 'teacher'] },
  { href: '/disputes', label: 'Disputes', roles: ['admin', 'teacher'] },
  { href: '/sessions', label: 'Sessions', roles: ['admin', 'teacher'] },
  { href: '/checkins', label: 'Check-ins', roles: ['admin', 'teacher'] },
  { href: '/cameras', label: 'Cameras', roles: ['admin'] },
  { href: '/settings', label: 'Settings', roles: ['admin'] },
]

export default function NavLinks({ role = 'admin' }: { role?: string }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <span className="font-mono text-xs tracking-widest" style={{ color: 'var(--accent-good)' }}>PSYS</span>
  }

  const visibleLinks = ALL_LINKS.filter(link => link.roles.includes(role))

  return (
    <div className="flex gap-5 items-center">
      <Link
        href="/"
        className="font-mono text-xs tracking-widest hover:opacity-80 transition-opacity"
        style={{ color: 'var(--accent-good)' }}
      >
        PSYS
      </Link>
      {visibleLinks.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'font-medium hover:opacity-80' : 'hover:opacity-80'}
            style={{ color: active ? 'var(--foreground)' : 'var(--muted)' }}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}

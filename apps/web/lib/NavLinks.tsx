'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/disputes', label: 'Disputes' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/checkins', label: 'Check-ins' },
  { href: '/cameras', label: 'Cameras' },
  { href: '/settings', label: 'Settings' },
]

export default function NavLinks() {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <span className="font-mono text-xs tracking-widest" style={{ color: 'var(--accent-good)' }}>PSYS</span>
  }

  return (
    <div className="flex gap-5 items-center">
      <span className="font-mono text-xs tracking-widest" style={{ color: 'var(--accent-good)' }}>PSYS</span>
      {LINKS.map((link) => {
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

'use client'

import { usePathname } from 'next/navigation'
import { logout } from '@/lib/auth/actions'

export default function LogoutButton() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <form action={logout}>
      <button type="submit" className="hover:opacity-80" style={{ color: 'var(--muted)' }}>
        Log out
      </button>
    </form>
  )
}

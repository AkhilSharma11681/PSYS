'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/auth/actions'

interface UserMenuProps {
  user: {
    name: string | null
    email: string | null
    role: string
  } | null
}

export default function UserMenu({ user }: UserMenuProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Hide entirely on login page or if no user is provided
  if (pathname === '/login' || !user) return null

  const displayName = user.name || user.email || 'Unknown User'
  const displayEmail = user.name && user.email && user.name.toLowerCase() !== user.email.toLowerCase() ? user.email : null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-full transition-colors focus:outline-none focus:ring-2"
        style={{
          background: isOpen ? 'var(--surface-elevated)' : 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          boxShadow: isOpen ? 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' : '0 1px 2px rgba(15,23,42,0.04)',
        }}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg border py-1.5 z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          role="menu"
        >
          {/* Info Section */}
          <div className="px-4 py-3" role="none">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Signed in as
            </p>
            <p className="text-sm font-semibold truncate leading-tight mb-0.5" style={{ color: 'var(--foreground)' }} title={displayName}>
              {displayName}
            </p>
            {displayEmail && (
              <p className="text-xs truncate mb-2" style={{ color: 'var(--text-secondary)' }} title={displayEmail}>
                {displayEmail}
              </p>
            )}
            <div className="mt-2">
              <span className="badge badge-neutral capitalize font-medium">{user.role}</span>
            </div>
          </div>

          <div className="border-t my-1.5" style={{ borderColor: 'var(--border)' }}></div>

          {/* Action Section */}
          <div className="px-1.5 pb-0.5" role="none">
            <form action={logout}>
              <button
                type="submit"
                className="w-full text-left flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-colors cursor-pointer"
                style={{ color: 'var(--foreground)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-soft)';
                  e.currentTarget.style.color = 'var(--primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--foreground)';
                }}
                role="menuitem"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

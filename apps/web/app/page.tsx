import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const [
    { count: studentCount },
    { count: sessionCount },
    { count: pendingDisputeCount },
    { count: uncertainCount },
    { count: cameraCount },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).eq('status', 'active'),
    supabase.from('class_sessions').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id),
    supabase.from('disputes').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).eq('status', 'pending'),
    supabase.from('final_attendance').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).in('status', ['uncertain', 'camera_issue']),
    supabase.from('cameras').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).eq('is_active', true),
  ])

  const stats = [
    { label: 'Active Students', value: studentCount ?? 0, href: '/students', attention: false },
    { label: 'Active Cameras', value: cameraCount ?? 0, href: '/cameras', attention: (cameraCount ?? 0) === 0 },
    { label: 'Total Sessions', value: sessionCount ?? 0, href: '/sessions', attention: false },
    { label: 'Pending Disputes', value: pendingDisputeCount ?? 0, href: '/sessions', attention: (pendingDisputeCount ?? 0) > 0 },
    { label: 'Needs Review', value: uncertainCount ?? 0, href: '/sessions', attention: (uncertainCount ?? 0) > 0 },
  ]

  const quickLinks = [
    { label: 'Add a student', desc: 'Enroll one student with a photo', href: '/students/new' },
    { label: 'Bulk import', desc: 'Enroll many students from a CSV', href: '/students/bulk-import' },
    { label: 'Sync check-ins', desc: 'Import external device data', href: '/checkins' },
    { label: 'View sessions', desc: 'Browse class sessions and results', href: '/sessions' },
    { label: 'Attendance settings', desc: 'Recalibrate finalization thresholds', href: '/settings' },
  ]

  return (
    <div className="page-shell">
      <div className="page-inner" style={{ maxWidth: '56rem' }}>
        <p className="page-eyebrow">Roll Register</p>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {user.full_name} · <span className="capitalize">{user.role}</span>
        </p>

        <div
          className="grid grid-cols-2 sm:grid-cols-5 mb-12 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="px-4 py-5 border-b border-r first:border-l transition-colors hover:bg-white/[0.03]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="text-4xl font-mono tabular-nums font-semibold"
                style={{ color: s.attention ? 'var(--accent-warn)' : 'var(--accent-good)' }}
              >
                {String(s.value).padStart(2, '0')}
              </div>
              <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--muted)' }}>
                {s.label}
              </div>
            </Link>
          ))}
        </div>

        <p className="page-eyebrow">Quick Actions</p>
        <div className="ledger">
          {quickLinks.map((l) => (
            <Link key={l.label} href={l.href} className="ledger-row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm" style={{ color: 'var(--accent-good)' }}>▎</span>
                <span className="text-sm font-medium">{l.label}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>— {l.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

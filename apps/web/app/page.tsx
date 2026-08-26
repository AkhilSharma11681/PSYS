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
    <div
      className="min-h-full px-6 py-10 sm:px-10"
      style={{ background: '#16211C', color: '#EDEADA' }}
    >
      <div className="max-w-4xl mx-auto">
        <p
          className="text-xs uppercase tracking-[0.2em] mb-1"
          style={{ color: '#93A399' }}
        >
          Roll Register
        </p>
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm mb-10" style={{ color: '#93A399' }}>
          {user.full_name} · <span className="capitalize">{user.role}</span>
        </p>

        <div
          className="grid grid-cols-2 sm:grid-cols-5 mb-12 border-t"
          style={{ borderColor: '#33443A' }}
        >
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="px-4 py-5 border-b border-r first:border-l transition-colors"
              style={{ borderColor: '#33443A' }}
            >
              <div
                className="text-4xl font-mono tabular-nums font-semibold"
                style={{ color: s.attention ? '#E8B94B' : '#8FBF9F' }}
              >
                {String(s.value).padStart(2, '0')}
              </div>
              <div
                className="text-xs uppercase tracking-wide mt-2"
                style={{ color: '#93A399' }}
              >
                {s.label}
              </div>
            </Link>
          ))}
        </div>

        <p
          className="text-xs uppercase tracking-[0.2em] mb-3"
          style={{ color: '#93A399' }}
        >
          Quick Actions
        </p>
        <div className="border-t" style={{ borderColor: '#33443A' }}>
          {quickLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="flex items-baseline gap-3 py-3 border-b group"
              style={{ borderColor: '#33443A' }}
            >
              <span
                className="font-mono text-sm transition-colors"
                style={{ color: '#8FBF9F' }}
              >
                ▎
              </span>
              <span className="text-sm font-medium">{l.label}</span>
              <span className="text-xs" style={{ color: '#93A399' }}>
                — {l.desc}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

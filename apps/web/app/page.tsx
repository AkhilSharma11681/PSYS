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
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).eq('status', 'active'),
    supabase.from('class_sessions').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id),
    supabase.from('disputes').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).eq('status', 'pending'),
    supabase.from('final_attendance').select('*', { count: 'exact', head: true })
      .eq('institution_id', user.institution_id).in('status', ['uncertain', 'camera_issue']),
  ])

  const cards = [
    { label: 'Active Students', value: studentCount ?? 0, href: '/students' },
    { label: 'Total Sessions', value: sessionCount ?? 0, href: '/sessions' },
    { label: 'Pending Disputes', value: pendingDisputeCount ?? 0, href: '/sessions' },
    { label: 'Needs Review', value: uncertainCount ?? 0, href: '/sessions' },
  ]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">
        Welcome back, {user.full_name} ({user.role}).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="text-sm text-gray-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="font-medium mb-3">Quick Links</h2>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/students/new" className="underline">+ Add a student</Link>
        <Link href="/students/bulk-import" className="underline">Bulk import students (CSV)</Link>
        <Link href="/checkins" className="underline">Sync external check-ins</Link>
        <Link href="/sessions" className="underline">View sessions</Link>
        <Link href="/settings" className="underline">Attendance settings</Link>
      </div>
    </div>
  )
}

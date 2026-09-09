import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import StudentsViewSwitcher from '../StudentsViewSwitcher'

export default async function ArchivedStudentsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, roll_number, deleted_at, status')
    .eq('institution_id', user.institution_id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="page-eyebrow">Enrollment</p>
            <div className="flex items-center gap-3">
              <h1 className="page-title" style={{ marginBottom: 0 }}>Students</h1>
              <StudentsViewSwitcher currentView="archived" />
            </div>
          </div>
        </div>
        <p className="page-subtitle">
          {students?.length ?? 0} archived {students?.length === 1 ? 'student' : 'students'} (retained for attendance history)
        </p>

        {error && (
          <p className="text-sm" style={{ color: 'var(--accent-bad)' }}>
            Failed to load archived students: {error.message}
          </p>
        )}

        {students && students.length === 0 ? (
          <p className="ledger-empty">No archived students.</p>
        ) : (
          <div className="ledger">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1fr 1.5fr 1fr' }}>
              <div>Name</div>
              <div>Roll No.</div>
              <div>Archived Date</div>
              <div>Status</div>
            </div>
            {students?.map((s) => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="ledger-row"
                style={{ gridTemplateColumns: '2fr 1fr 1.5fr 1fr' }}
              >
                <div className="text-sm font-medium">{s.full_name}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  {s.roll_number || '—'}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  {s.deleted_at ? new Date(s.deleted_at).toLocaleString() : '—'}
                </div>
                <div className="text-sm capitalize" style={{ color: 'var(--muted)' }}>
                  {s.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

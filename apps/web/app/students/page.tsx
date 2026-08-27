import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-good',
  inactive: 'badge-neutral',
  graduated: 'badge-warn',
  transferred: 'badge-warn',
}

function Badge({ label, variant }: { label: string; variant: string }) {
  return (
    <span className={`badge ${variant}`}>
      <span className="badge-dot" style={{ background: 'currentColor' }} />
      {label}
    </span>
  )
}

export default async function StudentsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, roll_number, status, enrollment_photo_count')
    .eq('institution_id', user.institution_id)
    .order('full_name')

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="page-eyebrow">Enrollment</p>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Students</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/students/bulk-import" className="btn-secondary">Bulk Import</Link>
            <Link href="/students/new" className="btn-primary">+ Add Student</Link>
          </div>
        </div>
        <p className="page-subtitle">{students?.length ?? 0} enrolled</p>

        {error && <p className="text-sm" style={{ color: 'var(--accent-bad)' }}>Failed to load students: {error.message}</p>}

        {students && students.length === 0 ? (
          <p className="ledger-empty">No students enrolled yet.</p>
        ) : (
          <div className="ledger">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
              <div>Name</div>
              <div>Roll No.</div>
              <div>Status</div>
              <div>Photos</div>
            </div>
            {students?.map((s) => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="ledger-row"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
              >
                <div className="text-sm font-medium">{s.full_name}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{s.roll_number || '—'}</div>
                <div><Badge label={s.status} variant={STATUS_BADGE[s.status] || 'badge-neutral'} /></div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{s.enrollment_photo_count}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

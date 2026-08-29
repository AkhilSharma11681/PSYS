import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { enrollStudent, scheduleClassSession } from '@/lib/enrollment/classes'

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: cls } = await supabase
    .from('classes')
    .select('id, subject, room_id, recurrence, is_active, rooms(name)')
    .eq('id', id)
    .single()

  const { data: enrolled } = await supabase
    .from('class_enrollments')
    .select('student_id, students(id, full_name, roll_number)')
    .eq('class_id', id)
    .eq('status', 'active')

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, roll_number')
    .eq('institution_id', user.institution_id)
    .eq('status', 'active')
    .order('full_name')

  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('id, scheduled_start, scheduled_end, status')
    .eq('class_id', id)
    .order('scheduled_start', { ascending: false })

  const enrolledIds = new Set(enrolled?.map((e) => e.student_id) || [])
  const availableStudents = students?.filter((s) => !enrolledIds.has(s.id)) || []

  return (
    <div className="page-shell">
      <div className="page-inner">
        <Link href="/classes" className="text-xs link-accent mb-3 inline-block">← All Classes</Link>
        <h1 className="page-title">{cls?.subject || 'Class'}</h1>
        <p className="page-subtitle">Room: {cls?.rooms?.name || '—'} · Recurrence: {cls?.recurrence || '—'} · Active: {cls?.is_active ? 'Yes' : 'No'}</p>

        <h2 className="text-sm font-semibold mt-6 mb-2">Enrolled Students ({enrolled?.length ?? 0})</h2>
        {enrolled && enrolled.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No students enrolled yet.</p>
        ) : (
          <ul className="ledger mb-6">
            {enrolled?.map((e) => (
              <li key={e.student_id} className="ledger-row">
                <span className="text-sm font-medium">{e.students?.full_name}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{e.students?.roll_number || '—'}</span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="text-sm font-semibold mt-6 mb-2">Enroll Student</h2>
        <form action={enrollStudent.bind(null, id)} className="mb-8 border rounded-lg p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="field-label">Select Student</label>
              <select name="student_id" required className="field-input">
                <option value="">Select a student</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number || '—'})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 md:text-right">
              <button type="submit" className="btn-primary">Enroll</button>
            </div>
          </div>
        </form>

        <h2 className="text-sm font-semibold mt-6 mb-2">Scheduled Sessions</h2>
        {sessions && sessions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No sessions scheduled yet.</p>
        ) : (
          <div className="ledger mb-6">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr' }}>
              <div>Start</div><div>End</div><div>Status</div><div>Link</div>
            </div>
            {sessions?.map((sess) => (
              <Link key={sess.id} href={`/sessions/${sess.id}`} className="ledger-row" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr' }}>
                <div className="text-xs font-medium">{new Date(sess.scheduled_start).toLocaleString()}</div>
                <div className="text-xs">{new Date(sess.scheduled_end).toLocaleString()}</div>
                <div><span className="badge badge-neutral">{sess.status}</span></div>
                <div className="text-xs" style={{ color: 'var(--accent-good)' }}>Details →</div>
              </Link>
            ))}
          </div>
        )}

        <h2 className="text-sm font-semibold mt-6 mb-2">Schedule Session</h2>
        <form action={scheduleClassSession.bind(null, id)} className="border rounded-lg p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="field-label">Scheduled Start</label>
              <input type="datetime-local" name="scheduled_start" required className="field-input" />
            </div>
            <div>
              <label className="field-label">Scheduled End</label>
              <input type="datetime-local" name="scheduled_end" required className="field-input" />
            </div>
            <div className="md:self-end">
              <button type="submit" className="btn-primary w-full">Schedule Session</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

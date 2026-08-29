import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClass } from '@/lib/enrollment/classes'

export default async function ClassesPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, subject, room_id, recurrence, is_active, rooms(name)')
    .eq('institution_id', user.institution_id)
    .order('subject')

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, roll_number')
    .eq('institution_id', user.institution_id)
    .eq('status', 'active')
    .order('full_name')

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('institution_id', user.institution_id)
    .order('name')

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="page-eyebrow">Classes</p>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Classes</h1>
          </div>
        </div>
        <p className="page-subtitle">{classes?.length ?? 0} class{classes?.length !== 1 ? 'es' : ''}</p>

        {user.role === 'admin' && (
          <form action={createClass} className="mb-8 border rounded-lg p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-3">Create New Class</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="field-label">Subject</label>
                <input name="subject" required placeholder="e.g. Mathematics" className="field-input" />
              </div>
              <div>
                <label className="field-label">Room</label>
                <select name="room_id" required className="field-input">
                  <option value="">Select a room</option>
                  {rooms?.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Recurrence (e.g. MON,WED 09:00-10:00)</label>
                <input name="recurrence" placeholder="Optional" className="field-input" />
              </div>
            </div>
            <button type="submit" className="btn-primary mt-4">Create Class</button>
          </form>
        )}

        {classes && classes.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No classes yet. Create one above.</p>
        ) : (
          <div className="ledger">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr' }}>
              <div>Subject</div><div>Room</div><div>Recurrence</div><div>Active</div><div>Link</div>
            </div>
            {classes?.map((c) => (
              <Link key={c.id} href={`/classes/${c.id}`} className="ledger-row" style={{ gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr' }}>
                <div className="text-sm font-medium">{c.subject}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{c.rooms?.name || '—'}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{c.recurrence || '—'}</div>
                <div>
                  <span className={`badge ${c.is_active ? 'badge-good' : 'badge-warn'}`}>{c.is_active ? 'Yes' : 'No'}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--accent-good)' }}>Details →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import CheckinUploadForm from '@/lib/enrollment/CheckinUploadForm'

export default async function CheckinsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('external_checkin_events')
    .select('id, external_student_ref, student_id, checked_in_at, synced_at')
    .eq('institution_id', user.institution_id)
    .order('synced_at', { ascending: false })
    .limit(50)

  return (
    <div className="page-shell">
      <div className="page-inner max-w-4xl">
        <p className="page-eyebrow">Integrations</p>
        <h1 className="page-title">External Check-in Sync</h1>
        <p className="page-subtitle">
          Import a CSV with columns: <code>student_ref,checked_in_at</code>. Rows are matched
          against student roll numbers for roster derivation.
        </p>

        <div className="card p-6 mb-8">
          <CheckinUploadForm />
        </div>

        <h2 className="text-base font-semibold mb-3 text-slate-900">Recent Events (last 50)</h2>
        {events && events.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="ledger">
              <div className="ledger-head" style={{ gridTemplateColumns: '2fr 2fr 1fr' }}>
                <div>Student Ref</div>
                <div>Checked In At</div>
                <div>Resolved</div>
              </div>
              {events.map((e) => (
                <div key={e.id} className="ledger-row" style={{ gridTemplateColumns: '2fr 2fr 1fr' }}>
                  <div className="text-sm font-mono font-medium">{e.external_student_ref}</div>
                  <div className="text-sm text-slate-500 font-sans tabular-nums">
                    {new Date(e.checked_in_at).toLocaleString()}
                  </div>
                  <div>
                    {e.student_id ? (
                      <span className="badge badge-good">✓ Resolved</span>
                    ) : (
                      <span className="badge badge-warn">Unmatched</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="ledger-empty">No check-in events synced yet.</p>
        )}
      </div>
    </div>
  )
}

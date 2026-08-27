import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'badge-neutral',
  in_progress: 'badge-warn',
  completed: 'badge-good',
  cancelled: 'badge-bad',
}

const PROCESSING_BADGE: Record<string, string> = {
  pending: 'badge-neutral',
  processing: 'badge-warn',
  finalized: 'badge-good',
  failed: 'badge-bad',
  needs_review: 'badge-warn',
}

function Badge({ label, variant }: { label: string; variant: string }) {
  return (
    <span className={`badge ${variant}`}>
      <span className="badge-dot" style={{ background: 'currentColor' }} />
      {label}
    </span>
  )
}

export default async function SessionsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: sessions, error } = await supabase
    .from('class_sessions')
    .select('id, scheduled_start, scheduled_end, status, processing_status, class_id, classes(subject)')
    .eq('institution_id', user.institution_id)
    .order('scheduled_start', { ascending: false })
    .limit(50)

  return (
    <div className="page-shell">
      <div className="page-inner">
        <p className="page-eyebrow">Class Sessions</p>
        <h1 className="page-title">Sessions</h1>
        <p className="page-subtitle">Every recorded and in-progress class session.</p>

        {error && <p className="text-sm" style={{ color: 'var(--accent-bad)' }}>Failed to load sessions: {error.message}</p>}

        {sessions && sessions.length === 0 ? (
          <p className="ledger-empty">No sessions yet.</p>
        ) : (
          <div className="ledger">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr' }}>
              <div>Subject</div>
              <div>Scheduled</div>
              <div>Status</div>
              <div>Processing</div>
            </div>
            {sessions?.map((s: any) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="ledger-row"
                style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr' }}
              >
                <div className="text-sm font-medium">{s.classes?.subject || '(no class)'}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  {s.scheduled_start ? new Date(s.scheduled_start).toLocaleString() : '—'}
                </div>
                <div><Badge label={s.status} variant={STATUS_BADGE[s.status] || 'badge-neutral'} /></div>
                <div>
                  {s.processing_status && (
                    <Badge label={s.processing_status} variant={PROCESSING_BADGE[s.processing_status] || 'badge-neutral'} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

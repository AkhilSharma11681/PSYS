import Link from 'next/link'
import { getTeacherSessions } from '@/lib/enrollment/attendance'

export const metadata = {
  title: 'Attendance | PSYS',
}

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

export default async function AttendanceOverviewPage() {
  const sessions = await getTeacherSessions()

  return (
    <div className="page-shell">
      <div className="page-inner">
        <p className="page-eyebrow">Roll Register</p>
        <h1 className="page-title">Attendance Review</h1>
        <p className="page-subtitle">Your assigned class sessions and their attendance statistics.</p>

        {sessions && sessions.length === 0 ? (
          <p className="ledger-empty">No sessions found.</p>
        ) : (
          <div className="ledger">
            <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 2.5fr' }}>
              <div>Class & Time</div>
              <div>Status</div>
              <div>Processing</div>
              <div>Attendance Summary</div>
            </div>
            {sessions.map((s: any) => {
              const summary = s.attendance_summary || {}
              const needsReviewCount = (summary.uncertain || 0) + (summary.camera_issue || 0)

              return (
                <Link
                  key={s.id}
                  href={`/attendance/${s.id}`}
                  className="ledger-row"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1fr 2.5fr' }}
                >
                  <div>
                    <div className="text-sm font-medium">{s.classes?.subject || '(no class)'}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.scheduled_start ? new Date(s.scheduled_start).toLocaleString() : '—'}
                    </div>
                  </div>

                  <div>
                    <Badge label={s.status} variant={STATUS_BADGE[s.status] || 'badge-neutral'} />
                  </div>

                  <div>
                    {s.processing_status && (
                      <Badge label={s.processing_status} variant={PROCESSING_BADGE[s.processing_status] || 'badge-neutral'} />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {needsReviewCount > 0 ? (
                      <span className="font-medium" style={{ color: 'var(--accent-warn)' }}>
                        ⚠️ {needsReviewCount} needs review
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-good)' }}>✓ All clear</span>
                    )}

                    <div className="flex gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                      {(summary.present || 0) > 0 && <span>{summary.present} present</span>}
                      {(summary.absent || 0) > 0 && <span>{summary.absent} absent</span>}
                      {(summary.left_early || 0) > 0 && <span>{summary.left_early} early-leave</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

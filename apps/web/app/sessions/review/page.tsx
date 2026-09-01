import Link from 'next/link'
import { getAllReviewItems, resolveReviewItem } from '@/lib/enrollment/attendance'

const STATUS_BADGE: Record<string, string> = {
  uncertain: 'badge-warn',
  camera_issue: 'badge-bad',
}

function Badge({ label, variant }: { label: string; variant: string }) {
  return (
    <span className={`badge ${variant}`}>
      <span className="badge-dot" style={{ background: 'currentColor' }} />
      {label}
    </span>
  )
}

export default async function ReviewQueuePage() {
  const items = await getAllReviewItems()

  return (
    <div className="page-shell">
      <div className="page-inner">
        <p className="page-eyebrow">Teacher Dashboard</p>
        <h1 className="page-title">Review Queue</h1>
        <p className="page-subtitle">
          Attendance records flagged as uncertain or camera_issue — resolve each with a human decision.
        </p>

        {items.length === 0 ? (
          <p className="ledger-empty">Nothing to review — all sessions are clean.</p>
        ) : (
          <div className="ledger">
            <div
              className="ledger-head"
              style={{ gridTemplateColumns: '2fr 1.5fr 0.8fr 0.6fr 1.2fr' }}
            >
              <div>Student</div>
              <div>Session</div>
              <div>Status</div>
              <div>Score</div>
              <div>Action</div>
            </div>
            {items.map((item: any) => {
              const resolve = resolveReviewItem.bind(null, item.id, item.session_id)
              return (
                <div
                  key={item.id}
                  className="ledger-row"
                  style={{ gridTemplateColumns: '2fr 1.5fr 0.8fr 0.6fr 1.2fr' }}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {item.students?.full_name ?? '—'}
                    </div>
                    {item.students?.roll_number && (
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {item.students.roll_number}
                      </div>
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/sessions/${item.session_id}`}
                      className="link-accent text-sm"
                    >
                      {item.class_sessions?.classes?.subject ?? 'Session'}
                    </Link>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      {item.class_sessions?.scheduled_start
                        ? new Date(item.class_sessions.scheduled_start).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <Badge
                      label={item.status}
                      variant={STATUS_BADGE[item.status] || 'badge-neutral'}
                    />
                  </div>
                  <div className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                    {item.presence_score != null
                      ? `${(item.presence_score * 100).toFixed(0)}%`
                      : '—'}
                  </div>
                  <div>
                    <form action={resolve} className="flex gap-1.5 items-center flex-wrap">
                      <select
                        name="new_status"
                        className="field-input"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        defaultValue="present"
                      >
                        <option value="present">present</option>
                        <option value="absent">absent</option>
                        <option value="left_early">left_early</option>
                      </select>
                      <button type="submit" className="btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                        Resolve
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

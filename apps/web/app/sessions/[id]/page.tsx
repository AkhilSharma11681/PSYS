import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/auth/session'
import { markPermittedExit, recordReturn } from '@/lib/enrollment/exceptions'
import { fileDispute, resolveDispute } from '@/lib/enrollment/disputes'
import { resolveReviewItem } from '@/lib/enrollment/attendance'
import ExportCsvButton from '@/lib/enrollment/ExportCsvButton'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'

const ATTENDANCE_BADGE: Record<string, string> = {
  present: 'badge-good',
  absent: 'badge-bad',
  left_early: 'badge-warn',
  uncertain: 'badge-warn',
  camera_issue: 'badge-bad',
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

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, class_id, scheduled_start, scheduled_end, status, processing_status, classes(subject)')
    .eq('id', id)
    .single()

  if (!session) {
    return (
      <div className="page-shell">
        <div className="page-inner">
          <p className="page-subtitle">Session not found.</p>
          <Link href="/sessions" className="link-accent text-sm">← Back to sessions</Link>
        </div>
      </div>
    )
  }

  const roster = session.class_id
    ? await supabase
        .from('class_enrollments')
        .select('student_id, students(id, full_name, roll_number)')
        .eq('class_id', session.class_id)
        .eq('status', 'active')
    : { data: [] }

  const studentName = (studentId: string) =>
    (roster.data?.find((r: any) => r.student_id === studentId)?.students as any)?.full_name ||
    studentId

  const [
    { data: exceptions },
    { data: finalAttendance },
  ] = await Promise.all([
    supabase
      .from('session_exceptions')
      .select('id, student_id, reason, exit_at, return_at, students(full_name)')
      .eq('session_id', id)
      .order('exit_at', { ascending: false }),
    supabase
      .from('final_attendance')
      .select('id, student_id, status, presence_score, exception_applied, students(full_name, roll_number)')
      .eq('session_id', id),
  ])

  const { data: existingDisputes } = await supabase
    .from('disputes')
    .select('id, final_attendance_id, status')
    .in('final_attendance_id', finalAttendance?.map((f) => f.id) || [])

  const disputeByAttendanceId = new Map(
    existingDisputes?.map((d) => [d.final_attendance_id, d]) || []
  )

  const markExit = markPermittedExit.bind(null, id)

  let reviewQueue: any[] = []
  try {
    const token = await getAccessToken()
    const res = await fetch(`${CAMERA_SERVICE_URL}/sessions/${id}/review`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      reviewQueue = data.flagged || []
    }
  } catch {
    reviewQueue = []
  }

  // Summary stats
  const presentCount = finalAttendance?.filter((f) => f.status === 'present').length ?? 0
  const absentCount = finalAttendance?.filter((f) => f.status === 'absent').length ?? 0
  const flaggedCount = finalAttendance?.filter((f) =>
    ['uncertain', 'camera_issue', 'left_early'].includes(f.status)
  ).length ?? 0

  return (
    <div className="page-shell">
      <div className="page-inner">
        <Link href="/sessions" className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          ← Sessions
        </Link>
        <div className="flex items-center justify-between mt-1 mb-1">
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {(session.classes as any)?.subject || '(no class)'}
          </h1>
          <ExportCsvButton sessionId={id} />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {session.scheduled_start
              ? new Date(session.scheduled_start).toLocaleString()
              : '—'}
          </span>
          <Badge label={session.status} variant={PROCESSING_BADGE[session.status] || 'badge-neutral'} />
          {session.processing_status && (
            <Badge label={session.processing_status} variant={PROCESSING_BADGE[session.processing_status] || 'badge-neutral'} />
          )}
        </div>

        {/* Summary cards */}
        {finalAttendance && finalAttendance.length > 0 && (
          <div
            className="grid grid-cols-3 mb-8 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            {[
              { label: 'Present', value: presentCount, color: 'var(--accent-good)' },
              { label: 'Absent', value: absentCount, color: 'var(--accent-bad)' },
              { label: 'Flagged', value: flaggedCount, color: 'var(--accent-warn)' },
            ].map((s) => (
              <div
                key={s.label}
                className="px-4 py-4 border-b border-r first:border-l"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="text-2xl font-mono tabular-nums font-semibold" style={{ color: s.color }}>
                  {String(s.value).padStart(2, '0')}
                </div>
                <div className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review queue */}
        {reviewQueue.length > 0 && (
          <>
            <p className="page-eyebrow" style={{ color: 'var(--accent-warn)' }}>
              Needs Review ({reviewQueue.length})
            </p>
            <div className="ledger mb-8">
              {reviewQueue.map((r: any) => {
                // Find the matching final_attendance row so we can offer resolve
                const fa = finalAttendance?.find((f) => f.student_id === r.student_id)
                const resolve = fa ? resolveReviewItem.bind(null, fa.id, id) : null

                return (
                  <div
                    key={r.student_id}
                    className="ledger-row"
                    style={{ gridTemplateColumns: '2fr 0.8fr 0.6fr 1.4fr' }}
                  >
                    <div className="text-sm font-medium">{studentName(r.student_id)}</div>
                    <div>
                      <Badge label={r.status} variant={ATTENDANCE_BADGE[r.status] || 'badge-warn'} />
                    </div>
                    <div className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                      {r.presence_score != null ? `${(r.presence_score * 100).toFixed(0)}%` : '—'}
                    </div>
                    <div>
                      {resolve ? (
                        <form action={resolve} className="flex gap-1.5 items-center">
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
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {r.evidence?.length || 0} evidence photo(s)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Final attendance */}
        {finalAttendance && finalAttendance.length > 0 && (
          <>
            <p className="page-eyebrow">Final Attendance</p>
            <div className="ledger mb-8">
              <div
                className="ledger-head"
                style={{ gridTemplateColumns: '2fr 0.8fr 0.6fr 1.4fr' }}
              >
                <div>Student</div>
                <div>Status</div>
                <div>Score</div>
                <div></div>
              </div>
              {finalAttendance.map((f: any) => {
                const dispute = disputeByAttendanceId.get(f.id) as any
                return (
                  <div
                    key={f.id}
                    className="ledger-row"
                    style={{ gridTemplateColumns: '2fr 0.8fr 0.6fr 1.4fr' }}
                  >
                    <div>
                      <div className="text-sm font-medium">{f.students?.full_name}</div>
                      {f.students?.roll_number && (
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{f.students.roll_number}</div>
                      )}
                      {f.exception_applied && (
                        <div className="text-xs" style={{ color: 'var(--accent-good)' }}>exception applied</div>
                      )}
                    </div>
                    <div>
                      <Badge label={f.status} variant={ATTENDANCE_BADGE[f.status] || 'badge-neutral'} />
                    </div>
                    <div className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                      {f.presence_score != null ? `${(f.presence_score * 100).toFixed(0)}%` : '—'}
                    </div>
                    <div>
                      {(() => {
                        if (!dispute) {
                          return (
                            <details className="text-sm">
                              <summary className="cursor-pointer link-accent text-xs">File dispute</summary>
                              <form
                                action={fileDispute.bind(null, f.id, id, f.student_id)}
                                className="flex items-center gap-2 mt-2"
                              >
                                <input
                                  name="reason"
                                  placeholder="Reason"
                                  className="field-input"
                                  style={{ width: 'auto', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                />
                                <button type="submit" className="btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                                  Submit
                                </button>
                              </form>
                            </details>
                          )
                        }
                        if (dispute.status === 'pending') {
                          return (
                            <details className="text-sm">
                              <summary className="cursor-pointer text-xs" style={{ color: 'var(--accent-warn)' }}>
                                Resolve dispute
                              </summary>
                              <form
                                action={resolveDispute.bind(null, dispute.id, id)}
                                className="flex flex-col gap-2 mt-2 items-start"
                              >
                                <select
                                  name="resolved_status_for_attendance"
                                  className="field-input"
                                  style={{ width: 'auto', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                >
                                  <option value="">Keep current status</option>
                                  <option value="present">present</option>
                                  <option value="absent">absent</option>
                                  <option value="left_early">left_early</option>
                                </select>
                                <div className="flex gap-2">
                                  <button type="submit" name="status" value="approved" className="btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                                    Approve
                                  </button>
                                  <button type="submit" name="status" value="rejected" className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                                    Reject
                                  </button>
                                </div>
                              </form>
                            </details>
                          )
                        }
                        return (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            dispute {dispute.status}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Mark permitted exit */}
        <p className="page-eyebrow">Permitted Exit</p>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
          For a student who genuinely needs to step out — excludes this time from their attendance calculation entirely.
        </p>
        <form action={markExit} className="flex items-center gap-3 mb-8 flex-wrap">
          <select name="student_id" required className="field-input" style={{ width: 'auto' }}>
            <option value="">Select student…</option>
            {roster.data?.map((r: any) => (
              <option key={r.student_id} value={r.student_id}>
                {r.students?.full_name} {r.students?.roll_number ? `(${r.students.roll_number})` : ''}
              </option>
            ))}
          </select>
          <input
            name="reason"
            placeholder="Reason (optional)"
            className="field-input flex-1"
            style={{ minWidth: '10rem' }}
          />
          <button type="submit" className="btn-primary whitespace-nowrap">
            Mark Exit
          </button>
        </form>

        {/* Exceptions list */}
        <p className="page-eyebrow">Exceptions This Session</p>
        {exceptions && exceptions.length > 0 ? (
          <div className="ledger">
            {exceptions.map((e: any) => (
              <div
                key={e.id}
                className="ledger-row"
                style={{ gridTemplateColumns: '1fr auto' }}
              >
                <div className="text-sm">
                  <span className="font-medium">{e.students?.full_name}</span>
                  {' — '}
                  {e.reason || 'no reason given'}
                  <span style={{ color: 'var(--muted)' }}>
                    {' · out at '}
                    {new Date(e.exit_at).toLocaleTimeString()}
                    {e.return_at
                      ? ` · returned at ${new Date(e.return_at).toLocaleTimeString()}`
                      : ' · not yet returned'}
                  </span>
                </div>
                {!e.return_at && (
                  <form action={recordReturn.bind(null, e.id, id)}>
                    <button type="submit" className="link-accent text-xs">
                      Mark returned
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="ledger-empty">No exceptions marked for this session.</p>
        )}
      </div>
    </div>
  )
}

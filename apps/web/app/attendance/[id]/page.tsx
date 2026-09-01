import { getReviewQueue, resolveReviewItem } from '@/lib/enrollment/attendance'
import { markPermittedExit, recordReturn } from '@/lib/enrollment/exceptions'
import ExportCsvButton from '@/lib/enrollment/ExportCsvButton'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Session Attendance | PSYS',
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

function StatusText({ status }: { status: string }) {
  if (status === 'present') return <span style={{ color: 'var(--accent-good)' }}>Present</span>
  if (status === 'absent') return <span style={{ color: 'var(--accent-bad)' }}>Absent</span>
  if (status === 'left_early') return <span style={{ color: 'var(--accent-warn)' }}>Left Early</span>
  if (status === 'camera_issue') return <span style={{ color: 'var(--accent-warn)' }}>Camera Issue</span>
  if (status === 'uncertain') return <span style={{ color: 'var(--accent-warn)' }}>Uncertain</span>
  return <span>{status}</span>
}

export default async function SessionAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const supabase = await createClient()

    const [{ data: session }, { data: attendance }, { data: exceptions }] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('id, class_id, scheduled_start, scheduled_end, status, processing_status, camera_status, finalized_at, classes(subject)')
        .eq('id', id)
        .single(),
      supabase
        .from('final_attendance')
        .select('id, student_id, status, presence_score, exception_applied, finalized_at, students(full_name, roll_number)')
        .eq('session_id', id)
        .order('students(full_name)', { ascending: true }),
      supabase
        .from('session_exceptions')
        .select('id, student_id, reason, exit_at, return_at, students(full_name)')
        .eq('session_id', id)
        .order('exit_at', { ascending: false }),
    ])

    if (!session) throw new Error('Session not found')

    const safeAttendance = attendance || []
    const safeExceptions = exceptions || []

    const reviewQueue = await getReviewQueue(id)

    const markExit = markPermittedExit.bind(null, id)

    const counts = {
      present: safeAttendance.filter((a: any) => a.status === 'present').length,
      absent: safeAttendance.filter((a: any) => a.status === 'absent').length,
      left_early: safeAttendance.filter((a: any) => a.status === 'left_early').length,
      review: reviewQueue.length,
      exceptions: safeExceptions.length
    }

    const enhancedReviewQueue = reviewQueue.map((r: any) => {
      const match = safeAttendance.find((a: any) => a.student_id === r.student_id)
      return {
        ...r,
        id: match?.id,
        students: match?.students || { full_name: 'Unknown', roll_number: null }
      }
    })

    return (
      <div className="page-shell">
        <div className="page-inner">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="page-eyebrow">Session Attendance</p>
              <h1 className="page-title">{Array.isArray(session.classes) ? session.classes[0]?.subject : (session.classes as any)?.subject || '(no class)'}</h1>
              <p className="page-subtitle mb-0">
                {session.scheduled_start ? new Date(session.scheduled_start).toLocaleString() : '—'}
              </p>
            </div>
            <ExportCsvButton sessionId={id} />
          </div>

          <div className="flex gap-3 mb-8">
            <Badge label={session.status} variant={STATUS_BADGE[session.status] || 'badge-neutral'} />
            <Badge label={`Processing: ${session.processing_status}`} variant={PROCESSING_BADGE[session.processing_status] || 'badge-neutral'} />
            <Badge label={`Camera: ${session.camera_status}`} variant={PROCESSING_BADGE[session.camera_status] || 'badge-neutral'} />
          </div>

          {/* 2-column: main + info rail */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main column */}
            <main className="flex-1 min-w-0">

              {/* Stats — card-based */}
              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-4">Status Summary</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="card card-compact">
                    <div className="font-sans text-2xl font-semibold tabular-nums" style={{ color: 'var(--accent-good)' }}>{counts.present}</div>
                    <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--text-muted)' }}>Present</div>
                  </div>
                  <div className="card card-compact">
                    <div className="font-sans text-2xl font-semibold tabular-nums" style={{ color: 'var(--accent-bad)' }}>{counts.absent}</div>
                    <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--text-muted)' }}>Absent</div>
                  </div>
                  <div className="card card-compact">
                    <div className="font-sans text-2xl font-semibold tabular-nums" style={{ color: 'var(--accent-warn)' }}>{counts.left_early}</div>
                    <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--text-muted)' }}>Left Early</div>
                  </div>
                  <div className="card card-compact">
                    <div className="font-sans text-2xl font-semibold tabular-nums" style={{ color: counts.review > 0 ? 'var(--accent-warn)' : 'var(--foreground)' }}>{counts.review}</div>
                    <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--text-muted)' }}>Needs Review</div>
                  </div>
                  <div className="card card-compact">
                    <div className="font-sans text-2xl font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{counts.exceptions}</div>
                    <div className="text-xs uppercase tracking-wide mt-2" style={{ color: 'var(--text-muted)' }}>Exceptions</div>
                  </div>
                </div>
              </section>

              {/* Needs Review */}
              {reviewQueue.length > 0 && (
                <section className="mb-10 card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--accent-warn)' }}>
                    ⚠️ Needs Review ({reviewQueue.length})
                  </h2>
                  <div className="ledger">
                    {enhancedReviewQueue.map((item: any) => (
                      <div key={item.id} className="pt-4 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="font-medium">{item.students.full_name}</div>
                            <div className="text-sm mt-1">Roll: {item.students.roll_number || '—'}</div>
                            <div className="text-sm mt-1">
                              System marked: <span style={{ color: 'var(--accent-warn)' }}>{item.status}</span>
                              {item.presence_score != null && ` (${(item.presence_score * 100).toFixed(0)}% presence)`}
                            </div>
                          </div>

                          <form className="card-compact" style={{ border: '1px solid var(--border)' }} action={resolveReviewItem.bind(null, item.id, id)}>
                            <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Resolve Override</div>
                            <div className="flex gap-2 items-center">
                              <select name="new_status" required className="field-input-sm !w-32">
                                <option value="">Status...</option>
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="left_early">Left Early</option>
                              </select>
                              <input type="text" name="notes" placeholder="Notes (optional)" className="field-input-sm !w-40" />
                              <button type="submit" className="btn-secondary-sm">Save</button>
                            </div>
                          </form>
                        </div>

                        {item.evidence && item.evidence.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Evidence Photos</div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {item.evidence.map((ev: any, idx: number) => (
                                <div key={idx} className="relative group">
                                  <img src={ev.evidence_photo_url} alt="Evidence" className="h-24 w-auto rounded border" style={{ borderColor: 'var(--border)' }} />
                                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">
                                    {(ev.quality_score * 100).toFixed(0)}% Q
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Finalized Attendance */}
              <section className="mb-10 card">
                <h2 className="text-lg font-semibold mb-4">Finalized Attendance</h2>
                <div className="ledger">
                  <div className="ledger-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr' }}>
                    <div>Student</div>
                    <div>Status</div>
                    <div>Presence</div>
                    <div>Exceptions</div>
                  </div>

                  {safeAttendance.map((item: any) => (
                    <div key={item.id} className="ledger-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr' }}>
                      <div>
                        <div className="text-sm font-medium">{item.students.full_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.students.roll_number || '—'}</div>
                      </div>
                      <div className="text-sm">
                        <StatusText status={item.status} />
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.presence_score != null ? `${(item.presence_score * 100).toFixed(0)}%` : '—'}
                      </div>
                      <div className="text-sm">
                        {item.exception_applied ? (
                          <span className="badge badge-neutral" style={{ color: 'var(--accent-good)' }}>Applied</span>
                        ) : '—'}
                      </div>
                    </div>
                  ))}

                  {safeAttendance.length === 0 && (
                    <div className="ledger-empty">Attendance hasn't been computed for this session yet.</div>
                  )}
                </div>
              </section>
            </main>

            {/* Right info rail */}
            <aside className="info-rail w-full lg:w-[320px] shrink-0">
              <section className="card mb-8">
                <h2 className="text-lg font-semibold mb-4">Mark Permitted Exit</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Excludes the student's time away from their attendance gap calculation.
                </p>
                <form action={markExit} className="space-y-4">
                  <div>
                    <label className="field-label">Student</label>
                    <select name="student_id" required className="field-input">
                      <option value="">Select student...</option>
                      {safeAttendance.map((a: any) => (
                        <option key={a.student_id} value={a.student_id}>
                          {a.students.full_name} {a.students.roll_number ? `(${a.students.roll_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Reason</label>
                    <input name="reason" placeholder="e.g. Restroom, Called to office" className="field-input" />
                  </div>
                  <button type="submit" className="btn-primary w-full">Mark Exit</button>
                </form>
              </section>

              <section className="card">
                <h2 className="text-lg font-semibold mb-4">Exception History</h2>
                <div className="ledger">
                  {safeExceptions.length === 0 && (
                    <div className="ledger-empty">No permitted exits marked for this session.</div>
                  )}

                  {safeExceptions.map((exc: any) => (
                    <div key={exc.id} className="py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm">{exc.students.full_name}</div>
                        {!exc.return_at && (
                          <form action={recordReturn.bind(null, exc.id, id)}>
                            <button type="submit" className="text-xs link-accent">Mark returned</button>
                          </form>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {exc.reason || 'No reason'} &middot; {new Date(exc.exit_at).toLocaleTimeString()}
                        {exc.return_at ? ` to ${new Date(exc.return_at).toLocaleTimeString()}` : ' (Ongoing)'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    )
  } catch (error: any) {
    return (
      <div className="page-shell">
        <div className="page-inner">
          <p className="page-eyebrow">Error</p>
          <h1 className="page-title">Session Not Found</h1>
          <p className="text-sm mt-4" style={{ color: 'var(--accent-bad)' }}>{error.message}</p>
        </div>
      </div>
    )
  }
}

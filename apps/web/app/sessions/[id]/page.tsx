import { createClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/auth/session'
import { markPermittedExit, recordReturn } from '@/lib/enrollment/exceptions'
import { fileDispute, resolveDispute } from '@/lib/enrollment/disputes'
import ExportCsvButton from '@/lib/enrollment/ExportCsvButton'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'

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
    return <div className="p-8">Session not found.</div>
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

  const { data: exceptions } = await supabase
    .from('session_exceptions')
    .select('id, student_id, reason, exit_at, return_at, students(full_name)')
    .eq('session_id', id)
    .order('exit_at', { ascending: false })

  const { data: finalAttendance } = await supabase
    .from('final_attendance')
    .select('id, student_id, status, presence_score, exception_applied, students(full_name)')
    .eq('session_id', id)

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
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      reviewQueue = data.flagged || []
    }
  } catch {
    reviewQueue = []
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">
          {(session.classes as any)?.subject || '(no class)'}
        </h1>
        <ExportCsvButton sessionId={id} />
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Status: {session.status} · Processing: {session.processing_status || '—'}
      </p>

      {reviewQueue.length > 0 && (
        <>
          <h2 className="font-medium mb-2 text-amber-700">Needs Review ({reviewQueue.length})</h2>
          <ul className="space-y-2 text-sm mb-8">
            {reviewQueue.map((r: any) => (
              <li key={r.student_id} className="border-b pb-2">
                <span className="font-medium">{studentName(r.student_id)}</span>
                {' — '}
                <span className="text-amber-600">{r.status}</span>
                {r.presence_score != null && ` (${(r.presence_score * 100).toFixed(0)}%)`}
                {r.evidence && r.evidence.length > 0 && ` · ${r.evidence.length} evidence photo(s)`}
              </li>
            ))}
          </ul>
        </>
      )}

      {finalAttendance && finalAttendance.length > 0 && (
        <>
          <h2 className="font-medium mb-2">Final Attendance</h2>
          <ul className="space-y-2 text-sm mb-8">
            {finalAttendance.map((f: any) => (
              <li key={f.id} className="border-b pb-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">{f.students?.full_name}</span>
                  {' — '}
                  <span className={f.status === 'present' ? '' : 'text-amber-600'}>
                    {f.status}
                  </span>
                  {f.presence_score != null && ` (${(f.presence_score * 100).toFixed(0)}%)`}
                  {f.exception_applied && ' · exception applied'}
                </div>
                {(() => {
                  const dispute = disputeByAttendanceId.get(f.id) as any
                  if (!dispute) {
                    return (
                      <details className="text-sm">
                        <summary className="cursor-pointer underline">File dispute</summary>
                        <form
                          action={fileDispute.bind(null, f.id, id, f.student_id)}
                          className="flex items-center gap-2 mt-2"
                        >
                          <input
                            name="reason"
                            placeholder="Reason"
                            className="border rounded-md px-2 py-1 text-sm"
                          />
                          <button
                            type="submit"
                            className="bg-black text-white px-3 py-1 rounded-md text-sm"
                          >
                            Submit
                          </button>
                        </form>
                      </details>
                    )
                  }
                  if (dispute.status === 'pending') {
                    return (
                      <details className="text-sm">
                        <summary className="cursor-pointer underline text-amber-700">
                          Resolve dispute
                        </summary>
                        <form
                          action={resolveDispute.bind(null, dispute.id, id)}
                          className="flex flex-col gap-2 mt-2 items-start"
                        >
                          <select
                            name="resolved_status_for_attendance"
                            className="border rounded-md px-2 py-1 text-sm"
                          >
                            <option value="">Keep current status</option>
                            <option value="present">present</option>
                            <option value="absent">absent</option>
                            <option value="left_early">left_early</option>
                            <option value="uncertain">uncertain</option>
                            <option value="camera_issue">camera_issue</option>
                          </select>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              name="status"
                              value="approved"
                              className="bg-black text-white px-3 py-1 rounded-md text-sm"
                            >
                              Approve
                            </button>
                            <button
                              type="submit"
                              name="status"
                              value="rejected"
                              className="border px-3 py-1 rounded-md text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </form>
                      </details>
                    )
                  }
                  return (
                    <span className="text-sm text-gray-400">dispute {dispute.status}</span>
                  )
                })()}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="font-medium mb-2">Mark Permitted Exit</h2>
      <p className="text-sm text-gray-500 mb-2">
        For a student who genuinely needs to step out — excludes this time from their
        attendance calculation entirely.
      </p>
      <form action={markExit} className="flex items-center gap-3 mb-8">
        <select name="student_id" required className="border rounded-md px-3 py-2 text-sm">
          <option value="">Select student...</option>
          {roster.data?.map((r: any) => (
            <option key={r.student_id} value={r.student_id}>
              {r.students?.full_name} {r.students?.roll_number ? `(${r.students.roll_number})` : ''}
            </option>
          ))}
        </select>
        <input
          name="reason"
          placeholder="Reason (optional)"
          className="border rounded-md px-3 py-2 text-sm flex-1"
        />
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded-md text-sm whitespace-nowrap"
        >
          Mark Exit
        </button>
      </form>

      <h2 className="font-medium mb-2">Exceptions This Session</h2>
      {exceptions && exceptions.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {exceptions.map((e: any) => (
            <li key={e.id} className="border-b pb-2 flex items-center justify-between">
              <div>
                <span className="font-medium">{e.students?.full_name}</span>
                {' — '}
                {e.reason || 'no reason given'}
                {' · out at '}
                {new Date(e.exit_at).toLocaleTimeString()}
                {e.return_at
                  ? ` · returned at ${new Date(e.return_at).toLocaleTimeString()}`
                  : ' · not yet returned'}
              </div>
              {!e.return_at && (
                <form action={recordReturn.bind(null, e.id, id)}>
                  <button type="submit" className="text-sm underline">
                    Mark returned
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No exceptions marked for this session.</p>
      )}
    </div>
  )
}

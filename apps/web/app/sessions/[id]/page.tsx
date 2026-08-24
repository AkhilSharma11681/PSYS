import { createAdminClient } from '@/lib/supabase/admin'
import { markPermittedExit, recordReturn } from '@/lib/enrollment/exceptions'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

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

  const { data: exceptions } = await supabase
    .from('session_exceptions')
    .select('id, student_id, reason, exit_at, return_at, students(full_name)')
    .eq('session_id', id)
    .order('exit_at', { ascending: false })

  const markExit = markPermittedExit.bind(null, id)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">
        {(session.classes as any)?.subject || '(no class)'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Status: {session.status} · Processing: {session.processing_status || '—'}
      </p>

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

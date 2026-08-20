import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import CheckinUploadForm from '@/lib/enrollment/CheckinUploadForm'

export default async function CheckinsPage() {
  const supabase = createAdminClient()

  const { data: events } = await supabase
    .from('external_checkin_events')
    .select('id, external_student_ref, student_id, checked_in_at, synced_at')
    .eq('institution_id', DEV_INSTITUTION_ID)
    .order('synced_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">External Check-in Sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Import a CSV with columns: <code>student_ref,checked_in_at</code>. Rows are matched
        against student roll numbers.
      </p>

      <CheckinUploadForm />

      <h2 className="font-medium mt-8 mb-2">Recent Events (last 50)</h2>
      {events && events.length > 0 ? (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Student Ref</th>
              <th className="py-2 pr-4">Checked In At</th>
              <th className="py-2">Resolved?</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-2 pr-4">{e.external_student_ref}</td>
                <td className="py-2 pr-4">{new Date(e.checked_in_at).toLocaleString()}</td>
                <td className="py-2">
                  {e.student_id ? '✓' : <span className="text-amber-600">unmatched</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500">No check-in events synced yet.</p>
      )}
    </div>
  )
}

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'

export default async function SessionsPage() {
  const supabase = createAdminClient()

  const { data: sessions, error } = await supabase
    .from('class_sessions')
    .select('id, scheduled_start, scheduled_end, status, processing_status, class_id, classes(subject)')
    .eq('institution_id', DEV_INSTITUTION_ID)
    .order('scheduled_start', { ascending: false })
    .limit(50)

  if (error) {
    return <div className="p-8 text-red-500">Failed to load sessions: {error.message}</div>
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Sessions</h1>

      {sessions && sessions.length === 0 ? (
        <p className="text-gray-500">No sessions yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Subject</th>
              <th className="py-2 pr-4">Scheduled</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Processing</th>
            </tr>
          </thead>
          <tbody>
            {sessions?.map((s: any) => (
              <tr key={s.id} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/sessions/${s.id}`} className="underline">
                    {s.classes?.subject || '(no class)'}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {s.scheduled_start ? new Date(s.scheduled_start).toLocaleString() : '—'}
                </td>
                <td className="py-2 pr-4">{s.status}</td>
                <td className="py-2">{s.processing_status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

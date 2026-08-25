import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'

export default async function StudentsPage() {
  const supabase = createAdminClient()

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, roll_number, status, enrollment_photo_count')
    .eq('institution_id', DEV_INSTITUTION_ID)
    .order('full_name')

  if (error) {
    return <div className="p-8 text-red-500">Failed to load students: {error.message}</div>
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex gap-2">
          <Link
            href="/students/bulk-import"
            className="border px-4 py-2 rounded-md text-sm"
          >
            Bulk Import
          </Link>
          <Link
            href="/students/new"
            className="bg-black text-white px-4 py-2 rounded-md text-sm"
          >
            + Add Student
          </Link>
        </div>
      </div>

      {students && students.length === 0 ? (
        <p className="text-gray-500">No students enrolled yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Roll No.</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Photos</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/students/${s.id}`} className="underline">
                    {s.full_name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{s.roll_number || '—'}</td>
                <td className="py-2 pr-4">{s.status}</td>
                <td className="py-2">{s.enrollment_photo_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

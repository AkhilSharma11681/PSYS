import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { addEnrollmentPhoto, updateStudent } from '@/lib/enrollment/actions'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) {
    return <div className="p-8">Student not found.</div>
  }

  const { data: photos } = await supabase
    .from('student_biometrics')
    .select('id, quality_score, is_primary, created_at')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  const { data: pendingJobs } = await supabase
    .from('enrollment_jobs')
    .select('id, status, error, created_at')
    .eq('student_id', id)
    .neq('status', 'done')
    .order('created_at', { ascending: false })

  const addPhoto = addEnrollmentPhoto.bind(null, id)
  const editStudent = updateStudent.bind(null, id)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/students" className="text-sm text-gray-500">
        ← Back to Students
      </Link>

      <h1 className="text-2xl font-semibold mt-2 mb-6">{student.full_name}</h1>

      <h2 className="font-medium mb-2">Edit Details</h2>
      <form action={editStudent} className="space-y-3 mb-8">
        <div>
          <label className="block text-sm mb-1">Full Name</label>
          <input
            name="full_name"
            defaultValue={student.full_name}
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Roll Number</label>
          <input
            name="roll_number"
            defaultValue={student.roll_number || ''}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select
            name="status"
            defaultValue={student.status}
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded-md text-sm"
        >
          Save Changes
        </button>
      </form>

      <h2 className="font-medium mb-2">
        Enrollment Photos ({student.enrollment_photo_count})
      </h2>
      {photos && photos.length > 0 ? (
        <ul className="space-y-1 mb-4 text-sm">
          {photos.map((p) => (
            <li key={p.id}>
              Quality: {p.quality_score?.toFixed(2)} {p.is_primary ? '(primary)' : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-4">No processed photos yet.</p>
      )}

      {pendingJobs && pendingJobs.length > 0 && (
        <div className="mb-6 text-sm text-amber-600 space-y-1">
          {pendingJobs.map((j) => (
            <p key={j.id}>
              {j.status === 'failed' ? `Failed: ${j.error}` : `${j.status}...`}
            </p>
          ))}
        </div>
      )}

      <h2 className="font-medium mb-2">Add Photo</h2>
      <form action={addPhoto} className="flex items-center gap-3">
        <input type="file" name="photo" accept="image/*" required className="text-sm" />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded-md text-sm">
          Upload
        </button>
      </form>
    </div>
  )
}

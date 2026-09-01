import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addEnrollmentPhoto, updateStudent, confirmConsent, dismissFailedEnrollmentJob } from '@/lib/enrollment/actions'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) {
    return (
      <div className="page-shell">
        <div className="page-inner">
          <p className="page-subtitle">Student not found.</p>
          <Link href="/students" className="link-accent text-sm">← Back to Students</Link>
        </div>
      </div>
    )
  }

  const { data: photos } = await supabase
    .from('student_biometrics')
    .select('id, quality_score, is_primary, created_at')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  const { data: pendingJobs } = await supabase
    .from('enrollment_jobs')
    .select('id, status, error, created_at, storage_path')
    .eq('student_id', id)
    .neq('status', 'done')
    .order('created_at', { ascending: false })

  const admin = createAdminClient()
  const jobPhotoUrls: Record<string, string> = {}
  if (pendingJobs) {
    for (const job of pendingJobs) {
      if (job.storage_path) {
        const { data: signed } = await admin.storage
          .from('enrollment-photos')
          .createSignedUrl(job.storage_path, 300)
        if (signed?.signedUrl) {
          jobPhotoUrls[job.id] = signed.signedUrl
        }
      }
    }
  }

  const addPhoto = addEnrollmentPhoto.bind(null, id)
  const editStudent = updateStudent.bind(null, id)
  const doConfirmConsent = confirmConsent.bind(null, id)

  return (
    <div className="page-shell">
      <div className="page-inner">
        <Link href="/students" className="link-accent text-xs mb-3 inline-block">← Back to Students</Link>
        <h1 className="page-title">{student.full_name}</h1>
        <p className="page-subtitle">Roll: {student.roll_number || '—'} &middot; {student.status}</p>

        {/* Consent */}
        <section className="mb-8">
          {student.consent_given ? (
            <div className="card">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--accent-good)' }}>✓</span>
                <p className="text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
                  Consent confirmed
                  {student.consent_recorded_at
                    ? ` on ${new Date(student.consent_recorded_at).toLocaleDateString()}`
                    : ''}.
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="text-sm mb-3" style={{ color: 'var(--accent-warn)' }}>
                No consent on record for this student. Confirm now if consent has been obtained.
              </p>
              <form action={doConfirmConsent}>
                <button type="submit" className="btn-secondary">Confirm Consent</button>
              </form>
            </div>
          )}
        </section>

        {/* Edit Details */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Edit Details</h2>
          <div className="card">
            <form action={editStudent} className="space-y-4">
              <div>
                <label className="field-label">Full Name</label>
                <input
                  name="full_name"
                  defaultValue={student.full_name}
                  required
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Roll Number</label>
                <input
                  name="roll_number"
                  defaultValue={student.roll_number || ''}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select
                  name="status"
                  defaultValue={student.status}
                  className="field-input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="transferred">Transferred</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">Save Changes</button>
            </form>
          </div>
        </section>

        {/* Enrollment Photos */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">
            Enrollment Photos ({student.enrollment_photo_count})
          </h2>
          <div className="card">
            {photos && photos.length > 0 ? (
              <ul className="space-y-2">
                {photos.map((p) => (
                  <li key={p.id} className="text-sm flex items-baseline gap-2 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span>Quality: {p.quality_score?.toFixed(2)}</span>
                      {p.is_primary && (
                        <span className="badge badge-good ml-2" style={{ fontSize: '0.65rem' }}>primary</span>
                      )}
                    </div>
                    {(p.quality_score ?? 1) < 0.5 && (
                      <span className="text-xs" style={{ color: 'var(--accent-warn)' }}>
                        — low sharpness, consider adding a sharper photo
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No processed photos yet.</p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Source photos are deleted after embedding generation (per privacy policy).
            </p>
          </div>
        </section>

        {/* Pending Jobs */}
        {pendingJobs && pendingJobs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3">Pending Jobs</h2>
            <div className="card">
              {pendingJobs.map((j) => (
                <div key={j.id} className="py-3 border-b last:border-0 flex items-start justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--accent-warn)' }}>
                      {j.status === 'failed' ? `Failed: ${j.error}` : `${j.status}…`}
                    </p>
                    {jobPhotoUrls[j.id] && (
                      <a
                        href={jobPhotoUrls[j.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2"
                      >
                        <img
                          src={jobPhotoUrls[j.id]}
                          alt="Uploaded photo"
                          className="h-24 rounded border"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </a>
                    )}
                  </div>
                  {j.status === 'failed' && (
                    <form action={dismissFailedEnrollmentJob.bind(null, j.id, id)}>
                      <button type="submit" className="btn-secondary-sm text-xs">
                        Dismiss
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add Photo */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Add Photo</h2>
          <div className="card">
            <form action={addPhoto} className="flex items-center gap-3">
              <input type="file" name="photo" accept="image/*" required className="text-sm" />
              <button type="submit" className="btn-primary">Upload</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

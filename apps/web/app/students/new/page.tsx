import { createStudent } from '@/lib/enrollment/actions'
import Link from 'next/link'

export default function NewStudentPage() {
  return (
    <div className="page-shell">
      <div className="page-inner">
        <Link href="/students" className="link-accent text-xs mb-3 inline-block">← Back to Students</Link>
        <h1 className="page-title">Add Student</h1>
        <p className="page-subtitle">Enroll a new student with photo and consent.</p>

        <div className="card">
          <form action={createStudent} className="space-y-4">
            <div>
              <label className="field-label">Full Name</label>
              <input
                name="full_name"
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Roll Number (optional)</label>
              <input
                name="roll_number"
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Enrollment Photo (optional for now)</label>
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="field-input"
              />
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                name="consent_given"
                id="consent_given"
                required
                className="mt-1"
              />
              <label htmlFor="consent_given" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Student has been informed and has given consent for biometric
                enrollment (face photo, embedding), per institutional policy.
              </label>
            </div>
            <button type="submit" className="btn-primary">Save Student</button>
          </form>
        </div>
      </div>
    </div>
  )
}

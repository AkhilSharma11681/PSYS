import { createStudent } from '@/lib/enrollment/actions'

export default function NewStudentPage() {
  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Add Student</h1>
      <form action={createStudent} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Full Name</label>
          <input
            name="full_name"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Roll Number (optional)</label>
          <input
            name="roll_number"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Enrollment Photo (optional for now)</label>
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="w-full text-sm"
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
          <label htmlFor="consent_given" className="text-sm text-gray-600">
            Student has been informed and has given consent for biometric
            enrollment (face photo, embedding), per institutional policy.
          </label>
        </div>
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded-md text-sm"
        >
          Save Student
        </button>
      </form>
    </div>
  )
}

import Link from 'next/link'
import StudentBulkImportForm from '@/lib/enrollment/StudentBulkImportForm'

export default function BulkImportPage() {
  return (
    <div className="p-8 max-w-lg mx-auto">
      <Link href="/students" className="text-sm text-gray-500">
        ← Back to Students
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Bulk Import Students</h1>
      <p className="text-sm text-gray-500 mb-6">
        Spec Phase B: bulk-upload students via CSV. Enrollment photos are
        added per-student afterward from each student's page.
      </p>
      <StudentBulkImportForm />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { importStudents } from '@/lib/enrollment/bulkImport'

export default function StudentBulkImportForm() {
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await importStudents(formData)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-3 mb-3">
        <div>
          <label className="block text-sm mb-1">CSV file (columns: full_name, roll_number)</label>
          <input type="file" name="file" accept=".csv" required className="text-sm" />
        </div>
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            name="consent_confirmed"
            id="consent_confirmed"
            required
            className="mt-1"
          />
          <label htmlFor="consent_confirmed" className="text-sm text-gray-600">
            I confirm all students in this file have been informed and have
            given consent for biometric enrollment, per institutional policy.
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white px-4 py-2 rounded-md text-sm disabled:opacity-50"
        >
          {pending ? 'Importing...' : 'Import CSV'}
        </button>
      </form>
      {result && (
        <div className="text-sm text-gray-600">
          <p>Created: {result.created}, Skipped (duplicate roll number or missing name): {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="text-red-500 mt-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

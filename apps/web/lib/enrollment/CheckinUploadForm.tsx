'use client'

import { useState } from 'react'
import { importCheckins } from '@/lib/enrollment/checkins'

export default function CheckinUploadForm() {
  const [result, setResult] = useState<{ resolved: number; unresolved: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await importCheckins(formData)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <form action={handleSubmit} className="flex items-center gap-3 mb-3">
        <input type="file" name="file" accept=".csv" required className="text-sm" />
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white px-4 py-2 rounded-md text-sm disabled:opacity-50"
        >
          {pending ? 'Importing...' : 'Import CSV'}
        </button>
      </form>

      {result && (
        <p className="text-sm text-gray-600">
          Imported: {result.resolved} resolved, {result.unresolved} unresolved (no matching roll number), {result.skipped} skipped (duplicate or missing fields)
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clearStudentBiometrics } from '@/lib/enrollment/actions'

export default function ClearBiometricsButton({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClear = () => {
    const confirmed = window.confirm(
      `Clear all enrollment photos/face data for ${studentName}? They can be re-enrolled with new photos afterward. This cannot be undone.`
    )
    if (!confirmed) return

    setError(null)
    startTransition(async () => {
      try {
        const result = await clearStudentBiometrics(studentId)
        router.refresh()
        if (result.count > 0) {
          alert(`Cleared ${result.count} photo(s).`)
        } else {
          alert('No photos to clear.')
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to clear biometrics')
        }
      }
    })
  }

  return (
    <div>
      {error && (
        <p className="text-xs mb-2" style={{ color: 'var(--accent-bad)' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleClear}
        disabled={isPending}
        className="btn-secondary text-xs"
        style={{
          color: 'var(--accent-bad)',
          borderColor: 'var(--accent-bad)',
        }}
      >
        {isPending ? 'Clearing…' : 'Clear Face Data'}
      </button>
    </div>
  )
}

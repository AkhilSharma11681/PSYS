'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStudent } from '@/lib/enrollment/actions'

export default function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${studentName}? This action cannot be undone.`
    )
    if (!confirmed) return

    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteStudent(studentId)
        if (result.mode === 'hard') {
          alert('Student permanently deleted.')
        } else {
          alert('Student archived (has attendance history) — view in Archived Students.')
        }
        router.push('/students')
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to delete student')
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
        onClick={handleDelete}
        disabled={isPending}
        className="btn-secondary text-xs"
        style={{
          color: 'var(--accent-bad)',
          borderColor: 'var(--accent-bad)',
        }}
      >
        {isPending ? 'Deleting…' : 'Delete Student'}
      </button>
    </div>
  )
}

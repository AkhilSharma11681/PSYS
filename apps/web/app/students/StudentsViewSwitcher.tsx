'use client'

import { useRouter } from 'next/navigation'

export default function StudentsViewSwitcher({
  currentView = 'active',
}: {
  currentView?: 'active' | 'archived'
}) {
  const router = useRouter()

  return (
    <select
      value={currentView === 'archived' ? '/students/archived' : '/students'}
      onChange={(e) => router.push(e.target.value)}
      aria-label="Filter students by status"
      className="field-input-sm cursor-pointer"
      style={{ width: 'auto' }}
    >
      <option value="/students">Active Students</option>
      <option value="/students/archived">Archived Students</option>
    </select>
  )
}

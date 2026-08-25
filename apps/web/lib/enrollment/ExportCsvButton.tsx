'use client'

import { useState } from 'react'
import { getSessionExportCsv } from '@/lib/enrollment/exportCsv'

export default function ExportCsvButton({ sessionId }: { sessionId: string }) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      const csv = await getSessionExportCsv(sessionId)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-sm underline text-gray-600 disabled:opacity-50"
    >
      {pending ? 'Exporting...' : 'Export CSV'}
    </button>
  )
}

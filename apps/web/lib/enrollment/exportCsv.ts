'use server'

import { getAccessToken } from '@/lib/auth/session'

export async function getSessionExportCsv(sessionId: string) {
  const token = await getAccessToken()
  const camaraServiceUrl = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'

  const response = await fetch(`${camaraServiceUrl}/sessions/${sessionId}/export.csv`, {
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to export CSV: ${response.status}`)
  }

  return response.text()
}

'use server'

import { getCurrentUser, getAccessToken } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Calls camera-service's POST /disputes rather than inserting into the
// disputes table directly -- the endpoint does real work (best-evidence
// photo lookup, dispute-window enforcement against attendance_config)
// that a raw Supabase insert would silently skip.
export async function fileDispute(
  finalAttendanceId: string,
  sessionId: string,
  studentId: string,
  formData: FormData
) {
  const reason = (formData.get('reason') as string)?.trim()
  const user = await getCurrentUser()
  const token = await getAccessToken()
  const camaraServiceUrl = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'

  const response = await fetch(`${camaraServiceUrl}/disputes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      institution_id: user.institution_id,
      final_attendance_id: finalAttendanceId,
      session_id: sessionId,
      student_id: studentId,
      reason: reason || null,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Failed to file dispute: ${response.status} ${errorBody}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath('/') // To update student dashboard if filed from there
}

export async function resolveDispute(
  disputeId: string,
  sessionId: string,
  formData: FormData
) {
  const status = formData.get('status') as string
  const resolvedStatus = (formData.get('resolved_status_for_attendance') as string) || null
  const token = await getAccessToken()
  const camaraServiceUrl = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'
  const response = await fetch(`${camaraServiceUrl}/disputes/${disputeId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      status,
      resolved_status_for_attendance: resolvedStatus || null,
    }),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Failed to resolve dispute: ${response.status} ${errorBody}`)
  }
  revalidatePath(`/sessions/${sessionId}`)
}

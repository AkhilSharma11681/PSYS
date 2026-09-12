'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getAccessToken } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Teacher dashboard queries
// ---------------------------------------------------------------------------

/** Fetch all sessions for the teacher's institution, newest first. */
export async function getTeacherSessions() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('class_sessions')
    .select('id, scheduled_start, scheduled_end, status, processing_status, class_id, classes(subject)')
    .eq('institution_id', user.institution_id)
    .order('scheduled_start', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Failed to load sessions: ${error.message}`)
  return data ?? []
}

/** Fetch final_attendance rows for a single session. */
export async function getSessionAttendance(sessionId: string) {
  await getCurrentUser() // auth guard
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('final_attendance')
    .select('id, student_id, status, presence_score, exception_applied, finalized_at, students(full_name, roll_number)')
    .eq('session_id', sessionId)
    .order('students(full_name)')

  if (error) throw new Error(`Failed to load attendance: ${error.message}`)
  return data ?? []
}

/** Fetch the review queue (uncertain / camera_issue) from camera-service. */
export async function getReviewQueue(sessionId: string) {
  await getCurrentUser() // auth guard
  const token = await getAccessToken()

  try {
    const res = await fetch(`${CAMERA_SERVICE_URL}/sessions/${sessionId}/review`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.flagged ?? []) as Array<{
      student_id: string
      status: string
      presence_score: number | null
      evidence: Array<{ url: string; quality_score: number }> | null
    }>
  } catch {
    return []
  }
}

/**
 * Cross-session: all final_attendance rows needing human review.
 * Returns uncertain + camera_issue rows across every session the
 * teacher's institution owns, with session & student info joined.
 */
export async function getAllReviewItems() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('final_attendance')
    .select(`
      id, session_id, student_id, status, presence_score, exception_applied,
      students(full_name, roll_number),
      class_sessions(scheduled_start, classes(subject))
    `)
    .eq('institution_id', user.institution_id)
    .in('status', ['uncertain', 'camera_issue'])
    .order('finalized_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(`Failed to load review items: ${error.message}`)
  return data ?? []
}

/**
 * Resolve a review-queue item by overriding its status.
 * Updates final_attendance directly and logs to audit_logs.
 */
export async function resolveReviewItem(
  finalAttendanceId: string,
  sessionId: string,
  formData: FormData
) {
  const newStatus = formData.get('new_status') as string
  const validStatuses = ['present', 'absent', 'left_early']
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`)
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('final_attendance')
    .update({ status: newStatus })
    .eq('id', finalAttendanceId)

  if (updateError) throw new Error(`Failed to update attendance: ${updateError.message}`)

  // Audit log — every human decision is recorded (spec requirement)
  await supabase.from('audit_logs').insert({
    institution_id: user.institution_id,
    action: 'review_resolve',
    actor_user_id: user.id,
    entity_type: 'final_attendance',
    entity_id: finalAttendanceId,
    metadata: {
      session_id: sessionId,
      new_status: newStatus,
    },
  })

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath('/sessions/review')
}

/**
 * Cross-session: all pending disputes for the teacher's institution.
 */
export async function getAllDisputes(statusFilter?: string) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  let query = supabase
    .from('disputes')
    .select(`
      id, final_attendance_id, student_id, reason, status, evidence_photo_url, created_at,
      students(full_name, roll_number),
      final_attendance(session_id, status, presence_score,
        class_sessions(scheduled_start, classes(subject))
      )
    `)
    .eq('institution_id', user.institution_id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to load disputes: ${error.message}`)
  return data ?? []
}

/**
 * Trigger an immediate real-time capture and recognition run on a camera for a session.
 */
export async function triggerCameraCapture(cameraId: string, sessionId: string) {
  await getCurrentUser() // auth guard
  const token = await getAccessToken()

  try {
    const res = await fetch(`${CAMERA_SERVICE_URL}/cameras/${cameraId}/capture-and-recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
      cache: 'no-store',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.detail || 'Capture failed' }
    }
    
    // Check if the camera service failed to get a frame
    if (data.capture_succeeded === false) {
      return { success: false, error: `Camera stream unreachable: ${data.error}` }
    }

    revalidatePath(`/sessions/${sessionId}/live`)
    revalidatePath(`/sessions/${sessionId}`)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to camera service' }
  }
}

/**
 * Get live observations and enrolled student roster for a live session.
 */
export async function getLiveSessionData(sessionId: string) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // 1. Session info
  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, class_id, camera_id, scheduled_start, scheduled_end, actual_start, actual_end, status, camera_status, processing_status, classes(subject, room_id)')
    .eq('id', sessionId)
    .single()

  if (!session) throw new Error('Session not found')

  // 2. Roster via derive_session_roster
  const { data: rosterRows } = await supabase.rpc('derive_session_roster', { p_session_id: sessionId })
  const studentIds = (rosterRows || []).map((r: any) => r.student_id)

  // 3. Students info
  let students: any[] = []
  if (studentIds.length > 0) {
    const { data: studentList } = await supabase
      .from('students')
      .select('id, full_name, roll_number')
      .in('id', studentIds)
    students = studentList || []
  }

  // 4. Live observations for this session
  const { data: observations } = await supabase
    .from('attendance_observations')
    .select('id, student_id, captured_at, similarity_score, quality_score, match_status, evidence_photo_url')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: false })
    .limit(100)

  // 5. Cameras for institution/room
  const { data: cameras } = await supabase
    .from('cameras')
    .select('id, label, stream_path, is_active')
    .eq('institution_id', user.institution_id)

  return {
    session,
    students,
    observations: observations || [],
    cameras: cameras || [],
  }
}


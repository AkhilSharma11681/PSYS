'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

// TEMPORARY: hardcoded until login/session exists. Matches the teacher
// test-user camera-service's own test scripts use. Spec's RLS policy
// requires marked_by = auth.uid() and role in ('teacher','admin') --
// enforced at the DB level once real auth exists; this admin-client path
// bypasses it for now like every other write in this app currently does.
const DEV_TEACHER_ID = '33333333-3333-3333-3333-333333333333'

export async function markPermittedExit(sessionId: string, formData: FormData) {
  const studentId = formData.get('student_id') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!studentId) {
    throw new Error('Student is required')
  }

  const supabase = createAdminClient()

  const { error } = await supabase.from('session_exceptions').insert({
    institution_id: DEV_INSTITUTION_ID,
    session_id: sessionId,
    student_id: studentId,
    marked_by: DEV_TEACHER_ID,
    reason: reason || null,
  })

  if (error) {
    throw new Error(`Failed to mark permitted exit: ${error.message}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
}

export async function recordReturn(exceptionId: string, sessionId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('session_exceptions')
    .update({ return_at: new Date().toISOString() })
    .eq('id', exceptionId)

  if (error) {
    throw new Error(`Failed to record return: ${error.message}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
}

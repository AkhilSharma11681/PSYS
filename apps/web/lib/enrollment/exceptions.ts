'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function markPermittedExit(sessionId: string, formData: FormData) {
  const studentId = formData.get('student_id') as string
  const reason = (formData.get('reason') as string)?.trim()

  if (!studentId) {
    throw new Error('Student is required')
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  const { error } = await supabase.from('session_exceptions').insert({
    institution_id: user.institution_id,
    session_id: sessionId,
    student_id: studentId,
    marked_by: user.id,
    reason: reason || null,
  })

  if (error) {
    throw new Error(`Failed to mark permitted exit: ${error.message}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
}

export async function recordReturn(exceptionId: string, sessionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('session_exceptions')
    .update({ return_at: new Date().toISOString() })
    .eq('id', exceptionId)

  if (error) {
    throw new Error(`Failed to record return: ${error.message}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
}

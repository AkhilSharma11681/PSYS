'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

export async function createClass(formData: FormData) {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    throw new Error('Only admins can create classes')
  }

  const subject = (formData.get('subject') as string)?.trim()
  const roomId = formData.get('room_id') as string
  const recurrence = (formData.get('recurrence') as string)?.trim() || null

  if (!subject) throw new Error('Subject is required')
  if (!roomId) throw new Error('Room is required')

  checkRateLimit(`createClass:${user.institution_id}`, 20, 60_000)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('classes')
    .insert({
      institution_id: user.institution_id,
      room_id: roomId,
      subject,
      teacher_id: user.id,
      recurrence,
      is_active: true,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create class: ${error?.message}`)
  revalidatePath('/classes')
  return data
}

export async function enrollStudent(classId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (user.role !== 'admin' && user.role !== 'teacher') {
    throw new Error('Only admin or teacher can enroll students')
  }

  const studentId = formData.get('student_id') as string
  if (!studentId) throw new Error('Student is required')

  checkRateLimit(`enrollStudent:${user.institution_id}`, 30, 60_000)
  const supabase = await createClient()

  // Verify class belongs to user's institution
  const { data: cls } = await supabase
    .from('classes')
    .select('institution_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.institution_id !== user.institution_id) {
    throw new Error('Class not found in your institution')
  }

  const { error } = await supabase
    .from('class_enrollments')
    .insert({
      institution_id: user.institution_id,
      class_id: classId,
      student_id: studentId,
      status: 'active',
    })

  if (error) {
    if (error.message?.includes('duplicate') || error.code === '23505') {
      throw new Error('Student is already enrolled in this class')
    }
    throw new Error(`Failed to enroll student: ${error.message}`)
  }
  revalidatePath(`/classes/${classId}`)
}

export async function scheduleClassSession(classId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (user.role !== 'admin' && user.role !== 'teacher') {
    throw new Error('Only admin or teacher can schedule sessions')
  }

  const scheduledStart = formData.get('scheduled_start') as string
  const scheduledEnd = formData.get('scheduled_end') as string

  if (!scheduledStart || !scheduledEnd) throw new Error('Both start and end times are required')
  if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
    throw new Error('Scheduled end must be after scheduled start')
  }

  checkRateLimit(`scheduleClassSession:${user.institution_id}`, 20, 60_000)
  const supabase = await createClient()

  // Verify class belongs to user's institution
  const { data: cls } = await supabase
    .from('classes')
    .select('institution_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.institution_id !== user.institution_id) {
    throw new Error('Class not found in your institution')
  }

  const { error } = await supabase
    .from('class_sessions')
    .insert({
      institution_id: user.institution_id,
      class_id: classId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: 'scheduled',
      roster_source: 'full_enrollment_fallback',
      camera_status: 'unknown',
      processing_status: 'pending',
    })

  if (error) throw new Error(`Failed to schedule session: ${error.message}`)
  revalidatePath(`/classes/${classId}`)
  revalidatePath('/sessions')
  revalidatePath('/attendance')
}

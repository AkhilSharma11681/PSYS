'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function uploadPhotoAndQueueJob(
  supabase: ReturnType<typeof createAdminClient>,
  institutionId: string,
  studentId: string,
  photo: File
) {
  const ext = photo.name.split('.').pop() || 'jpg'
  const storagePath = `${institutionId}/${studentId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('enrollment-photos')
    .upload(storagePath, photo)

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`)
  }

  const { error: jobError } = await supabase
    .from('enrollment_jobs')
    .insert({
      institution_id: institutionId,
      student_id: studentId,
      storage_path: storagePath,
      status: 'pending',
    })

  if (jobError) {
    throw new Error(`Failed to queue embedding job: ${jobError.message}`)
  }
}

export async function createStudent(formData: FormData) {
  const fullName = (formData.get('full_name') as string)?.trim()
  const rollNumber = (formData.get('roll_number') as string)?.trim()
  const photo = formData.get('photo') as File | null

  if (!fullName) {
    throw new Error('Full name is required')
  }

  const supabase = createAdminClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      institution_id: DEV_INSTITUTION_ID,
      full_name: fullName,
      roll_number: rollNumber || null,
      status: 'active',
    })
    .select()
    .single()

  if (studentError || !student) {
    throw new Error(`Failed to create student: ${studentError?.message}`)
  }

  if (photo && photo.size > 0) {
    await uploadPhotoAndQueueJob(supabase, DEV_INSTITUTION_ID, student.id, photo)
  }

  revalidatePath('/students')
  redirect(`/students/${student.id}`)
}

export async function addEnrollmentPhoto(studentId: string, formData: FormData) {
  const photo = formData.get('photo') as File | null

  if (!photo || photo.size === 0) {
    throw new Error('Photo is required')
  }

  const supabase = createAdminClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('institution_id')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    throw new Error('Student not found')
  }

  await uploadPhotoAndQueueJob(supabase, student.institution_id, studentId, photo)

  revalidatePath(`/students/${studentId}`)
}

export async function updateStudent(studentId: string, formData: FormData) {
  const fullName = (formData.get('full_name') as string)?.trim()
  const rollNumber = (formData.get('roll_number') as string)?.trim()
  const status = formData.get('status') as string

  if (!fullName) {
    throw new Error('Full name is required')
  }

  const validStatuses = ['active', 'inactive', 'graduated', 'transferred']
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status')
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('students')
    .update({
      full_name: fullName,
      roll_number: rollNumber || null,
      status,
    })
    .eq('id', studentId)

  if (error) {
    throw new Error(`Failed to update student: ${error.message}`)
  }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/students')
}

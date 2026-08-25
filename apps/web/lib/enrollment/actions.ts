'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Storage writes stay on the admin client for now -- the enrollment-photos
// bucket has zero storage policies (RLS enabled, deny-all for anon/
// authenticated), so a session-scoped client would fail the upload.
// Flagged as a follow-up: add storage policies scoped to institution_id
// in the object path, then switch this to the session client too.
async function uploadPhotoAndQueueJob(institutionId: string, studentId: string, photo: File) {
  const admin = createAdminClient()
  const ext = photo.name.split('.').pop() || 'jpg'
  const storagePath = `${institutionId}/${studentId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('enrollment-photos')
    .upload(storagePath, photo)

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`)
  }

  const { error: jobError } = await admin
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
  const consentGiven = formData.get('consent_given') === 'on'

  if (!fullName) {
    throw new Error('Full name is required')
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      institution_id: user.institution_id,
      full_name: fullName,
      roll_number: rollNumber || null,
      status: 'active',
      consent_given: consentGiven,
      consent_recorded_at: consentGiven ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (studentError || !student) {
    throw new Error(`Failed to create student: ${studentError?.message}`)
  }

  if (photo && photo.size > 0) {
    await uploadPhotoAndQueueJob(user.institution_id, student.id, photo)
  }

  revalidatePath('/students')
  redirect(`/students/${student.id}`)
}

export async function addEnrollmentPhoto(studentId: string, formData: FormData) {
  const photo = formData.get('photo') as File | null

  if (!photo || photo.size === 0) {
    throw new Error('Photo is required')
  }

  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('institution_id')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    throw new Error('Student not found')
  }

  await uploadPhotoAndQueueJob(student.institution_id, studentId, photo)

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

  const supabase = await createClient()

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

export async function confirmConsent(studentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({
      consent_given: true,
      consent_recorded_at: new Date().toISOString(),
    })
    .eq('id', studentId)

  if (error) {
    throw new Error(`Failed to confirm consent: ${error.message}`)
  }

  revalidatePath(`/students/${studentId}`)
}

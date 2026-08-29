'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Storage uploads now use the session client (not admin) because storage policies
// allow authenticated users to upload to their institution's folder. The session
// user's institution_id matches the folder path, so RLS allows the upload.
async function uploadPhotoAndQueueJob(institutionId: string, studentId: string, photo: File) {
  const supabase = await createClient()
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
  const consentGiven = formData.get('consent_given') === 'on'

  if (!fullName) {
    throw new Error('Full name is required')
  }
  if (!consentGiven) {
    throw new Error('Consent must be given before enrollment (spec Section 9)')
  }

  const user = await getCurrentUser()
  checkRateLimit(`createStudent:${user.institution_id}`, 20, 60_000)

  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      institution_id: user.institution_id,
      full_name: fullName,
      roll_number: rollNumber || null,
      status: 'active',
      consent_given: true,
      consent_recorded_at: new Date().toISOString(),
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

  checkRateLimit(`addEnrollmentPhoto:${student.institution_id}`, 30, 60_000)

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

  // Spec Section 9 (Privacy & Biometric Data Lifecycle): "when a student
  // leaves the institution, their student_biometrics row is deleted."
  // Scoped to graduated/transferred only -- NOT inactive (temporary,
  // "semester break", student expected to return). Session client is
  // used here (not admin) so RLS institution-scoping still applies.
  if (status === 'graduated' || status === 'transferred') {
    const { error: biometricsError } = await supabase
      .from('student_biometrics')
      .delete()
      .eq('student_id', studentId)

    if (biometricsError) {
      throw new Error(`Failed to delete biometrics: ${biometricsError.message}`)
    }
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

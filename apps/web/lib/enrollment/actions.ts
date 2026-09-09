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

export async function dismissFailedEnrollmentJob(jobId: string, studentId: string) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    throw new Error('Unauthorized: only admins and teachers can dismiss failed jobs')
  }

  const supabase = await createClient()

  // First fetch the job to get its storage path and verify state
  const { data: job, error: fetchError } = await supabase
    .from('enrollment_jobs')
    .select('storage_path, status')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    throw new Error('Failed to fetch job details')
  }

  if (job.status !== 'failed') {
    throw new Error('Only failed jobs can be dismissed')
  }

  // Delete the source file from Storage to prevent orphans
  if (job.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('enrollment-photos')
      .remove([job.storage_path])

    if (storageError) {
      console.error(`Failed to delete storage file for job ${jobId}: ${storageError.message}`)
      // Proceeding with job row deletion anyway so the UI doesn't get permanently stuck
    }
  }

  // Delete the job record from database
  const { error: deleteError } = await supabase
    .from('enrollment_jobs')
    .delete()
    .eq('id', jobId)

  if (deleteError) {
    throw new Error(`Failed to delete job record: ${deleteError.message}`)
  }

  revalidatePath(`/students/${studentId}`)
}

export async function deleteStudent(studentId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: only admins can delete students')
  }

  checkRateLimit(`deleteStudent:${user.institution_id}`, 10, 60_000)

  const supabase = await createClient()

  // 1. Fetch student info
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('institution_id, full_name, roll_number')
    .eq('id', studentId)
    .single()

  if (fetchError || !student) {
    throw new Error(`Failed to fetch student details: ${fetchError?.message || 'Not found'}`)
  }

  // 2. Check for history
  const [
    { count: enrollmentCount },
    { count: obsCount },
    { count: finalAttCount },
    { count: disputesCount },
    { count: excCount },
    { count: extCount }
  ] = await Promise.all([
    supabase.from('class_enrollments').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('attendance_observations').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('final_attendance').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('session_exceptions').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('external_checkin_events').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
  ])

  const hasHistory = (
    (enrollmentCount || 0) > 0 ||
    (obsCount || 0) > 0 ||
    (finalAttCount || 0) > 0 ||
    (disputesCount || 0) > 0 ||
    (excCount || 0) > 0 ||
    (extCount || 0) > 0
  )

  let mode: 'hard' | 'soft' = 'hard'

  if (hasHistory) {
    // 3B. Soft Delete
    mode = 'soft'
    const { error: updateError } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', studentId)
      
    if (updateError) throw new Error(`Failed to soft-delete student: ${updateError.message}`)
  } else {
    // 3A. Hard Delete
    mode = 'hard'
    
    const { error: biometricsError } = await supabase
      .from('student_biometrics')
      .delete()
      .eq('student_id', studentId)
      
    if (biometricsError) throw new Error(`Failed to delete biometrics: ${biometricsError.message}`)
    
    // Delete enrollment_jobs and associated storage photos
    const { data: jobs } = await supabase
      .from('enrollment_jobs')
      .select('id, storage_path')
      .eq('student_id', studentId)
      
    if (jobs && jobs.length > 0) {
      const pathsToDelete = jobs.map(j => j.storage_path).filter(Boolean) as string[]
      if (pathsToDelete.length > 0) {
        await supabase.storage.from('enrollment-photos').remove(pathsToDelete)
      }
      
      const { error: jobsError } = await supabase
        .from('enrollment_jobs')
        .delete()
        .eq('student_id', studentId)
        
      if (jobsError) throw new Error(`Failed to delete enrollment jobs: ${jobsError.message}`)
    }
    
    // Hard delete the student using the new admin-scoped DELETE policy
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)
      
    if (deleteError) throw new Error(`Failed to delete student row: ${deleteError.message}`)
  }

  // Log to audit_logs
  await supabase.from('audit_logs').insert({
    institution_id: student.institution_id,
    actor_user_id: user.id,
    action: 'student_deleted',
    entity_type: 'student',
    entity_id: studentId,
    metadata: {
      full_name: student.full_name,
      roll_number: student.roll_number,
      mode
    }
  })

  revalidatePath('/students')
  return { mode }
}

export async function clearStudentBiometrics(studentId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: only admins can clear biometrics')
  }

  const supabase = await createClient()

  // 1. Fetch student info
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('institution_id, full_name, roll_number')
    .eq('id', studentId)
    .single()

  if (fetchError || !student) {
    throw new Error(`Failed to fetch student details: ${fetchError?.message || 'Not found'}`)
  }

  checkRateLimit(`clearStudentBiometrics:${student.institution_id}`, 5, 60_000)

  // 2. Fetch biometric IDs to delete
  const { data: biometrics, error: fetchBioError } = await supabase
    .from('student_biometrics')
    .select('id')
    .eq('student_id', studentId)

  if (fetchBioError) {
    throw new Error(`Failed to fetch biometrics: ${fetchBioError.message}`)
  }

  const bioIds = biometrics.map(b => b.id)
  const deletedCount = bioIds.length

  if (deletedCount === 0) {
    return { count: 0 }
  }

  // 3. Delete biometrics
  const { error: deleteBioError } = await supabase
    .from('student_biometrics')
    .delete()
    .in('id', bioIds)

  if (deleteBioError) {
    throw new Error(`Failed to delete biometrics: ${deleteBioError.message}`)
  }

  // 4. Reset photo count
  const { error: updateError } = await supabase
    .from('students')
    .update({ enrollment_photo_count: 0 })
    .eq('id', studentId)

  if (updateError) {
    throw new Error(`Failed to reset enrollment photo count: ${updateError.message}`)
  }

  // 5. Log audit trail
  await supabase.from('audit_logs').insert({
    institution_id: student.institution_id,
    actor_user_id: user.id,
    action: 'biometrics_cleared',
    entity_type: 'student',
    entity_id: studentId,
    metadata: {
      full_name: student.full_name,
      roll_number: student.roll_number,
      biometrics_deleted_count: deletedCount
    }
  })

  // 6. Revalidate
  revalidatePath(`/students/${studentId}`)
  revalidatePath('/students/archived')

  return { count: deletedCount }
}

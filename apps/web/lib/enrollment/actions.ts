'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
    const ext = photo.name.split('.').pop() || 'jpg'
    const storagePath = `${DEV_INSTITUTION_ID}/${student.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('enrollment-photos')
      .upload(storagePath, photo)

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`)
    }

    const { error: jobError } = await supabase
      .from('enrollment_jobs')
      .insert({
        institution_id: DEV_INSTITUTION_ID,
        student_id: student.id,
        storage_path: storagePath,
        status: 'pending',
      })

    if (jobError) {
      throw new Error(`Failed to queue embedding job: ${jobError.message}`)
    }
  }

  revalidatePath('/students')
  redirect('/students')
}

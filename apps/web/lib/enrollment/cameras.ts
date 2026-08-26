'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function createCamera(formData: FormData) {
  const roomId = formData.get('room_id') as string
  const host = (formData.get('host') as string)?.trim()
  const streamPath = (formData.get('stream_path') as string)?.trim()
  const credentialRef = (formData.get('credential_ref') as string)?.trim()
  const label = (formData.get('label') as string)?.trim() || 'primary'

  if (!roomId || !host || !streamPath || !credentialRef) {
    throw new Error('Room, host, stream path, and credential ref are all required')
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cameras').insert({
    institution_id: user.institution_id,
    room_id: roomId,
    host,
    stream_path: streamPath,
    credential_ref: credentialRef,
    label,
  })

  if (error) {
    throw new Error(`Failed to register camera: ${error.message}`)
  }

  revalidatePath('/cameras')
}

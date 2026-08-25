import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, institution_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Logged in but no matching users row found — contact an admin to link your account.')
  }

  return profile
}

export async function getAccessToken() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return session.access_token
}

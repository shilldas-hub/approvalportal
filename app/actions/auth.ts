'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: 'requester' | 'approver'
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // 1. Create the auth user
  const { data, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) return { error: authError.message }
  if (!data.user) return { error: 'Signup failed. Please try again.' }

  // 2. Insert profile — runs server-side so the session cookie is already set
  //    and auth.uid() resolves correctly for the RLS policy.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    role,
  })
  if (profileError) return { error: profileError.message }

  return {}
}

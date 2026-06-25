import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RequesterClient from './RequesterClient'

export default async function RequesterDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (profile.role !== 'requester') redirect('/dashboard/approver')

  // Fetch requests with decisions joined
  const { data: requests } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, note, status, created_at, decided_at,
      decisions ( comment, approver_id )
    `)
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <RequesterClient
      user={{ id: user.id, email: user.email! }}
      profile={profile}
      initialRequests={requests ?? []}
    />
  )
}

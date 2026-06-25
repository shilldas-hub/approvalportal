import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApproverClient from './ApproverClient'

export default async function ApproverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (profile.role !== 'approver') redirect('/dashboard/requester')

  // Pending requests with requester profile
  const { data: pendingRequests } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at,
      profiles ( full_name ),
      comments ( id, profile_id, text, created_at, profiles(full_name) )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Recently decided requests (last 15)
  const { data: decidedRequests } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, priority, attachment_url, status, decided_at,
      profiles ( full_name ),
      decisions ( comment ),
      comments ( id, profile_id, text, created_at, profiles(full_name) )
    `)
    .in('status', ['approved', 'denied'])
    .order('decided_at', { ascending: false })
    .limit(15)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ApproverClient
      user={{ id: user.id, email: user.email! }}
      profile={profile}
      initialPending={(pendingRequests ?? []) as unknown as Parameters<typeof ApproverClient>[0]['initialPending']}
      initialDecided={(decidedRequests ?? []) as unknown as Parameters<typeof ApproverClient>[0]['initialDecided']}
    />
  )
}

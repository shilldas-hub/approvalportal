'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Create a new time-off request ──────────────────────────
export async function createRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const type = formData.get('type') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const note = formData.get('note') as string

  if (!type || !startDate || !endDate) {
    throw new Error('Type, start date, and end date are required')
  }

  if (new Date(endDate) < new Date(startDate)) {
    throw new Error('End date must be on or after start date')
  }

  const { error } = await supabase.from('requests').insert({
    requester_id: user.id,
    type,
    start_date: startDate,
    end_date: endDate,
    note: note || null,
    status: 'pending',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/requester')
}

// ── Approve a request ──────────────────────────────────────
export async function approveRequest(requestId: string, comment: string = '') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify approver role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'approver') throw new Error('Unauthorized')

  // Update request status
  const { error: updateError } = await supabase
    .from('requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  // Insert decision record
  await supabase.from('decisions').insert({
    request_id: requestId,
    approver_id: user.id,
    comment: comment || null,
  })

  revalidatePath('/dashboard/approver')
  revalidatePath('/dashboard/requester')
}

// ── Deny a request ─────────────────────────────────────────
export async function denyRequest(requestId: string, comment: string = '') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify approver role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'approver') throw new Error('Unauthorized')

  // Update request status
  const { error: updateError } = await supabase
    .from('requests')
    .update({ status: 'denied', decided_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  // Insert decision record
  await supabase.from('decisions').insert({
    request_id: requestId,
    approver_id: user.id,
    comment: comment || null,
  })

  revalidatePath('/dashboard/approver')
  revalidatePath('/dashboard/requester')
}

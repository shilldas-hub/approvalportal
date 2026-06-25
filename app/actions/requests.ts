'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Create a new request ───────────────────────────────────
export async function createRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const category = formData.get('category') as string
  const type = formData.get('type') as string
  const note = formData.get('note') as string

  if (!category || !type) {
    throw new Error('Category and type are required')
  }

  let startDate: string | null = null
  let endDate: string | null = null
  const details: Record<string, string> = {}

  if (category === 'Time Off') {
    startDate = formData.get('start_date') as string
    endDate = formData.get('end_date') as string
    if (!startDate || !endDate) throw new Error('Start and end dates are required for Time Off')
    if (new Date(endDate) < new Date(startDate)) throw new Error('End date must be on or after start date')
  } else if (category === 'Budget') {
    details.amount = formData.get('amount') as string
    details.purpose = formData.get('purpose') as string
    if (!details.amount || !details.purpose) throw new Error('Amount and purpose are required')
  } else if (category === 'Equipment') {
    details.item_name = formData.get('item_name') as string
    details.estimated_cost = formData.get('estimated_cost') as string
    details.link = formData.get('link') as string
    if (!details.item_name || !details.estimated_cost) throw new Error('Item name and estimated cost are required')
  } else if (category === 'Access') {
    details.system_name = formData.get('system_name') as string
    details.role_required = formData.get('role_required') as string
    if (!details.system_name || !details.role_required) throw new Error('System name and role are required')
  } else {
    throw new Error('Invalid category')
  }

  const { error } = await supabase.from('requests').insert({
    requester_id: user.id,
    category,
    type,
    start_date: startDate,
    end_date: endDate,
    details,
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

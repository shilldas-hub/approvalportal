'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Helper for Notifications ─────────────────────────────────
async function notify(message: string) {
  try {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }).catch(e => console.error("Notify fail", e))
  } catch(e) {}
}

// ── Create a new request ───────────────────────────────────
export async function createRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const requesterName = profile?.full_name || 'Someone'

  const category = formData.get('category') as string
  const type = formData.get('type') as string
  const note = formData.get('note') as string
  const priority = formData.get('priority') as string || 'Normal'
  const file = formData.get('file') as File | null

  if (!category || !type) throw new Error('Category and type are required')

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
  }

  // Handle File Upload
  let attachmentUrl = null
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    
    const { error: uploadError, data } = await supabase.storage
      .from('attachments')
      .upload(fileName, file)
      
    if (uploadError) {
      console.error('Upload Error:', uploadError)
      throw new Error('Failed to upload file')
    }
    
    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(fileName)
    attachmentUrl = publicUrlData.publicUrl
  }

  // Handle Dynamic Routing (Assign to an approver)
  const { data: approver } = await supabase.from('profiles').select('id').eq('role', 'approver').limit(1).single()
  const assignedTo = approver?.id || null

  const { data: reqData, error } = await supabase.from('requests').insert({
    requester_id: user.id,
    category,
    type,
    start_date: startDate,
    end_date: endDate,
    details,
    note: note || null,
    priority,
    attachment_url: attachmentUrl,
    assigned_to: assignedTo,
    status: 'pending',
  }).select('id').single()

  if (error) throw new Error(error.message)

  notify(`🚨 *New Request* [${priority}]\n*${requesterName}* submitted a new *${category}* request: ${type}.\nID: \`${reqData?.id}\``)

  revalidatePath('/dashboard/requester')
  revalidatePath('/dashboard/approver')
}

// ── Approve a request ──────────────────────────────────────
export async function approveRequest(requestId: string, comment: string = '') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'approver') throw new Error('Unauthorized')

  const { error: updateError } = await supabase
    .from('requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('decisions').insert({
    request_id: requestId,
    approver_id: user.id,
    comment: comment || null,
  })

  notify(`✅ *Request Approved*\nManager *${profile?.full_name}* approved request \`${requestId}\`.`)

  revalidatePath('/dashboard/approver')
  revalidatePath('/dashboard/requester')
}

// ── Deny a request ─────────────────────────────────────────
export async function denyRequest(requestId: string, comment: string = '') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'approver') throw new Error('Unauthorized')

  const { error: updateError } = await supabase
    .from('requests')
    .update({ status: 'denied', decided_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('decisions').insert({
    request_id: requestId,
    approver_id: user.id,
    comment: comment || null,
  })
  
  notify(`❌ *Request Denied*\nManager *${profile?.full_name}* denied request \`${requestId}\`.\nReason: ${comment || 'None provided'}`)

  revalidatePath('/dashboard/approver')
  revalidatePath('/dashboard/requester')
}

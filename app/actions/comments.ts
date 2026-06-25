'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addComment(requestId: string, text: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (!text.trim()) throw new Error('Comment cannot be empty')

  const { error } = await supabase.from('comments').insert({
    request_id: requestId,
    profile_id: user.id,
    text: text.trim(),
  })

  if (error) throw new Error(error.message)

  // Notify via Telegram about the new comment
  try {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const name = profile?.full_name || 'Someone'
    
    // We send this async so it doesn't block the UI response
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `💬 *New Comment* on request \`${requestId}\`\n*${name}* says: "${text.trim()}"` })
    }).catch(e => console.error("Failed to trigger notify", e))
  } catch(e) {}

  revalidatePath('/dashboard/requester')
  revalidatePath('/dashboard/approver')
}

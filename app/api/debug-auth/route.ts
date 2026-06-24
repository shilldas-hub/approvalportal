import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: sessionData } = await supabase.auth.getSession()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  return NextResponse.json({
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40) + '...',
      anonKeyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) + '...',
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    },
    cookies: allCookies.map(c => ({ name: c.name, valueLength: c.value.length })),
    session: sessionData.session ? { userId: sessionData.session.user.id, expiresAt: sessionData.session.expires_at } : null,
    user: userData.user ? { id: userData.user.id, email: userData.user.email } : null,
    userError: userError?.message ?? null,
  })
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Using getSession() here to read auth state from cookies locally (no outbound
  // network call). The individual dashboard pages use getUser() for secure validation.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const path = request.nextUrl.pathname

  // IMPORTANT: always copy refreshed Supabase cookies onto redirect responses
  // so the browser never holds a stale/expired token.
  function redirectTo(url: string) {
    const response = NextResponse.redirect(new URL(url, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie =>
      response.cookies.set(cookie.name, cookie.value, cookie)
    )
    return response
  }

  // Redirect unauthenticated users to login
  if (!user && path.startsWith('/dashboard')) {
    return redirectTo('/auth/login')
  }

  // Redirect authenticated users away from auth pages
  if (user && (path === '/auth/login' || path === '/auth/signup')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'approver') {
      return redirectTo('/dashboard/approver')
    }
    return redirectTo('/dashboard/requester')
  }

  // Enforce role-based dashboard access
  if (user && path.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      await supabase.auth.signOut()
      return redirectTo('/auth/login')
    }

    if (path.startsWith('/dashboard/approver') && profile.role !== 'approver') {
      return redirectTo('/dashboard/requester')
    }
    if (path.startsWith('/dashboard/requester') && profile.role !== 'requester') {
      return redirectTo('/dashboard/approver')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
}

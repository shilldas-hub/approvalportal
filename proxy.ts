import { NextResponse, type NextRequest } from 'next/server'

// Minimal pass-through proxy.
// All auth protection is handled by page server components (Node.js runtime).
// Supabase session refresh is handled client-side by the browser SDK.
export function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
}

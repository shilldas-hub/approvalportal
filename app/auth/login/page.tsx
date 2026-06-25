'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTip, setShowTip] = useState(true)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Call the Route Handler — server signs in and sets auth cookies
    // explicitly on the HTTP response (Set-Cookie headers).
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      setLoading(false)
      return
    }

    // Cookies are now in the browser's cookie jar (Set-Cookie processed).
    // Full-page navigation so the proxy sees the fresh session cookie.
    window.location.href = data.redirectTo
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(24,95,165,0.15) 0%, #080d1a 60%)' }}>
      
      {/* Tips Popup */}
      {showTip && (
        <div className="absolute top-6 right-6 z-50 max-w-xs glass-card p-4 border border-blue-500/30 shadow-lg shadow-blue-900/20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quick Tips
            </h3>
            <button 
              onClick={() => setShowTip(false)} 
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-xs text-slate-300 space-y-3 mt-1">
            <div>
              <p className="font-semibold text-slate-200">Employee -</p>
              <p>Email: <span className="font-mono text-[11px] bg-slate-800/50 px-1 py-0.5 rounded text-slate-300">shilldasemployeeb@gmail.com</span></p>
              <p>Password: <span className="font-mono text-[11px] bg-slate-800/50 px-1 py-0.5 rounded text-slate-300">111empb111</span></p>
            </div>
            <div>
              <p className="font-semibold text-slate-200">Approver -</p>
              <p>Email: <span className="font-mono text-[11px] bg-slate-800/50 px-1 py-0.5 rounded text-slate-300">shilldasmanagerb@gmail.com</span></p>
              <p>Password: <span className="font-mono text-[11px] bg-slate-800/50 px-1 py-0.5 rounded text-slate-300">shilldasmanagerb</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="green-dot" />
          <span className="text-xl font-bold tracking-tight text-white">Nebula</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-lg font-semibold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to your account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

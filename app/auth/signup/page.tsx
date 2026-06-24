'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/app/actions/auth'

type Role = 'requester' | 'approver'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('requester')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signUp(email, password, fullName, role)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Show success then redirect to login — the login page uses
    // the Route Handler which properly sets cookies before navigation.
    setSuccess(true)
    setTimeout(() => { window.location.href = '/auth/login' }, 1500)
  }

  const roleCard = (value: Role, label: string, description: string, icon: string) => (
    <button
      id={`role-${value}`}
      type="button"
      onClick={() => setRole(value)}
      className="flex-1 text-left p-4 rounded-xl border transition-all duration-200"
      style={{
        background: role === value ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
        borderColor: role === value ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{description}</div>
    </button>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(24,95,165,0.15) 0%, #080d1a 60%)' }}>
      
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="green-dot" />
          <span className="text-xl font-bold tracking-tight text-white">Nebula</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-lg font-semibold text-white mb-1">Create your account</h1>
          <p className="text-sm text-slate-400 mb-6">Join your team on Nebula</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
              <input
                id="signup-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jordan Kim"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                id="signup-email"
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
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">I am a…</label>
              <div className="flex gap-3">
                {roleCard('requester', 'Employee', 'Submit requests', '🙋')}
                {roleCard('approver', 'Manager', 'Review & decide', '✅')}
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                ✓ Account created! Redirecting to login…
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? 'Creating account…' : success ? 'Account created!' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

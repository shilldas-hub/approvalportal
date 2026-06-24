'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createRequest } from '@/app/actions/requests'
import { signOut } from '@/app/actions/auth'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'

type Request = {
  id: string
  type: string
  start_date: string
  end_date: string
  note: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  decided_at: string | null
  decisions: { comment: string | null; approver_id: string }[]
}

type Props = {
  user: { id: string; email: string }
  profile: { full_name: string; role: string }
  initialRequests: Request[]
}

const LEAVE_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'WFH']

function dayCount(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

function fmtDate(d: string) {
  return format(parseISO(d), 'MMM d')
}

function fmtDateFull(d: string) {
  return format(parseISO(d), 'MMM d, yyyy')
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function StatusBadge({ status }: { status: Request['status'] }) {
  const map = {
    pending: { cls: 'badge-pending', label: '⏳ Pending' },
    approved: { cls: 'badge-approved', label: '✓ Approved' },
    denied: { cls: 'badge-denied', label: '✕ Denied' },
  }
  const { cls, label } = map[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

export default function RequesterClient({ user, profile, initialRequests }: Props) {
  const [requests, setRequests] = useState<Request[]>(initialRequests)
  const [type, setType] = useState('Vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('requester-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `requester_id=eq.${user.id}`,
        },
        async () => {
          // Refetch with decisions joined
          const { data } = await supabase
            .from('requests')
            .select(`id, type, start_date, end_date, note, status, created_at, decided_at, decisions ( comment, approver_id )`)
            .eq('requester_id', user.id)
            .order('created_at', { ascending: false })
          if (data) setRequests(data as Request[])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSuccessMsg('')

    if (!startDate || !endDate) {
      setFormError('Please select both start and end dates.')
      return
    }
    if (endDate < startDate) {
      setFormError('End date must be on or after start date.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('type', type)
      fd.set('start_date', startDate)
      fd.set('end_date', endDate)
      fd.set('note', note)
      await createRequest(fd)
      setStartDate('')
      setEndDate('')
      setNote('')
      setSuccessMsg('Request submitted!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }, [type, startDate, endDate, note])

  const days = startDate && endDate && endDate >= startDate
    ? dayCount(startDate, endDate)
    : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(24,95,165,0.12) 0%, #080d1a 55%)' }}>
      {/* Topbar */}
      <div className="topbar">
        <div className="flex items-center gap-2.5">
          <div className="green-dot" />
          <span className="text-sm font-bold text-white tracking-tight">Nebula</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:block">{profile.full_name}</span>
          <div className="avatar">{initials(profile.full_name)}</div>
          <form action={signOut}>
            <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        {/* New Request Form */}
        <div className="mb-2">
          <p className="section-label">New request</p>
        </div>
        <div className="glass-card p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
              <select
                id="req-type"
                value={type}
                onChange={e => setType(e.target.value)}
                className="input-base"
                style={{ cursor: 'pointer' }}
              >
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">From</label>
                <input
                  id="req-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="input-base"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">To</label>
                <input
                  id="req-end-date"
                  type="date"
                  required
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="input-base"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Day count preview */}
            {days !== null && (
              <p className="text-xs text-blue-400">
                {days} {days === 1 ? 'day' : 'days'} — {fmtDate(startDate)}
                {startDate !== endDate ? ` to ${fmtDate(endDate)}` : ''}
              </p>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Note <span className="text-slate-600">(optional)</span></label>
              <textarea
                id="req-note"
                rows={2}
                placeholder="Add context for your manager…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="input-base resize-none"
              />
            </div>

            {formError && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}
            {successMsg && (
              <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
                ✓ {successMsg}
              </div>
            )}

            <button id="req-submit" type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </div>

        {/* My Requests */}
        <div className="divider" />
        <div className="flex items-center justify-between mb-3">
          <p className="section-label mb-0">My requests</p>
          {requests.length > 0 && (
            <span className="text-xs text-slate-500">{requests.length} total</span>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">
            No requests yet — submit one above ↑
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const dc = dayCount(req.start_date, req.end_date)
              const comment = req.decisions?.[0]?.comment
              return (
                <div key={req.id} className="req-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {req.type} · {dc} {dc === 1 ? 'day' : 'days'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(req.start_date)}
                        {req.start_date !== req.end_date ? ` – ${fmtDate(req.end_date)}` : ''}
                        {' · '}
                        <span className="text-slate-500">submitted {fmtDateFull(req.created_at)}</span>
                      </div>
                      {req.note && (
                        <div className="text-xs text-slate-500 mt-1.5 italic">"{req.note}"</div>
                      )}
                      {comment && req.status !== 'pending' && (
                        <div className="text-xs mt-2 px-3 py-2 rounded-lg"
                          style={{
                            background: req.status === 'approved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            border: req.status === 'approved' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                            color: req.status === 'approved' ? '#6ee7b7' : '#fca5a5',
                          }}>
                          Manager: "{comment}"
                        </div>
                      )}
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

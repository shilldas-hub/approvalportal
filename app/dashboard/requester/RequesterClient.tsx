'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createRequest } from '@/app/actions/requests'
import { signOut } from '@/app/actions/auth'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'

type Request = {
  id: string
  category: string
  type: string
  start_date: string | null
  end_date: string | null
  details: Record<string, string>
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

const CATEGORIES = ['Time Off', 'Budget', 'Equipment', 'Access']
const LEAVE_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'WFH']
const BUDGET_TYPES = ['Software', 'Hardware', 'Travel', 'Training', 'Other']
const EQUIPMENT_TYPES = ['Laptop', 'Monitor', 'Accessories', 'Phone', 'Other']
const ACCESS_TYPES = ['Database', 'AWS', 'GitHub', 'Internal Tool', 'Other']

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
  const [category, setCategory] = useState('Time Off')
  const [type, setType] = useState('Vacation')
  
  // Form fields
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [itemName, setItemName] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [link, setLink] = useState('')
  const [systemName, setSystemName] = useState('')
  const [roleRequired, setRoleRequired] = useState('')
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
          const { data } = await supabase
            .from('requests')
            .select(`id, category, type, start_date, end_date, details, note, status, created_at, decided_at, decisions ( comment, approver_id )`)
            .eq('requester_id', user.id)
            .order('created_at', { ascending: false })
          if (data) setRequests(data as Request[])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  // Update default type when category changes
  useEffect(() => {
    if (category === 'Time Off') setType(LEAVE_TYPES[0])
    else if (category === 'Budget') setType(BUDGET_TYPES[0])
    else if (category === 'Equipment') setType(EQUIPMENT_TYPES[0])
    else if (category === 'Access') setType(ACCESS_TYPES[0])
  }, [category])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSuccessMsg('')

    if (category === 'Time Off') {
      if (!startDate || !endDate) return setFormError('Please select both start and end dates.')
      if (endDate < startDate) return setFormError('End date must be on or after start date.')
    } else if (category === 'Budget') {
      if (!amount || !purpose) return setFormError('Amount and purpose are required.')
    } else if (category === 'Equipment') {
      if (!itemName || !estimatedCost) return setFormError('Item name and estimated cost are required.')
    } else if (category === 'Access') {
      if (!systemName || !roleRequired) return setFormError('System name and role are required.')
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('category', category)
      fd.set('type', type)
      fd.set('note', note)
      
      if (category === 'Time Off') {
        fd.set('start_date', startDate)
        fd.set('end_date', endDate)
      } else if (category === 'Budget') {
        fd.set('amount', amount)
        fd.set('purpose', purpose)
      } else if (category === 'Equipment') {
        fd.set('item_name', itemName)
        fd.set('estimated_cost', estimatedCost)
        fd.set('link', link)
      } else if (category === 'Access') {
        fd.set('system_name', systemName)
        fd.set('role_required', roleRequired)
      }

      await createRequest(fd)
      
      // Reset forms
      setStartDate(''); setEndDate(''); setAmount(''); setPurpose(''); 
      setItemName(''); setEstimatedCost(''); setLink(''); 
      setSystemName(''); setRoleRequired(''); setNote('');
      
      setSuccessMsg('Request submitted!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }, [category, type, startDate, endDate, amount, purpose, itemName, estimatedCost, link, systemName, roleRequired, note])

  const days = startDate && endDate && endDate >= startDate ? dayCount(startDate, endDate) : null

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
            
            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="input-base"
                  style={{ cursor: 'pointer' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} style={{ background: '#111827' }}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="input-base"
                  style={{ cursor: 'pointer' }}
                >
                  {category === 'Time Off' && LEAVE_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Budget' && BUDGET_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Equipment' && EQUIPMENT_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Access' && ACCESS_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Dynamic Fields */}
            {category === 'Time Off' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">From</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">To</label>
                  <input type="date" required value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="input-base" style={{ colorScheme: 'dark' }} />
                </div>
                {days !== null && (
                  <p className="text-xs text-blue-400 col-span-2">
                    {days} {days === 1 ? 'day' : 'days'} — {fmtDate(startDate)}
                    {startDate !== endDate ? ` to ${fmtDate(endDate)}` : ''}
                  </p>
                )}
              </div>
            )}

            {category === 'Budget' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount ($)</label>
                  <input type="number" required placeholder="150" value={amount} onChange={e => setAmount(e.target.value)} className="input-base" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Purpose</label>
                  <input type="text" required placeholder="e.g. Figma annual subscription" value={purpose} onChange={e => setPurpose(e.target.value)} className="input-base" />
                </div>
              </div>
            )}

            {category === 'Equipment' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Item Name</label>
                  <input type="text" required placeholder="e.g. Magic Mouse" value={itemName} onChange={e => setItemName(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Estimated Cost ($)</label>
                  <input type="number" required placeholder="99" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} className="input-base" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Link (Optional)</label>
                  <input type="url" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="input-base" />
                </div>
              </div>
            )}

            {category === 'Access' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">System Name</label>
                  <input type="text" required placeholder="e.g. Production DB" value={systemName} onChange={e => setSystemName(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Role Required</label>
                  <input type="text" required placeholder="e.g. Read-Only" value={roleRequired} onChange={e => setRoleRequired(e.target.value)} className="input-base" />
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Note <span className="text-slate-600">(optional)</span></label>
              <textarea
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

            <button type="submit" disabled={submitting} className="btn-primary">
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
              const comment = req.decisions?.[0]?.comment
              
              let summary = ''
              if (req.category === 'Time Off') {
                const dc = req.start_date && req.end_date ? dayCount(req.start_date, req.end_date) : 0
                summary = `${dc} ${dc === 1 ? 'day' : 'days'}`
                if (req.start_date) summary += ` (${fmtDate(req.start_date)}${req.start_date !== req.end_date ? ` – ${fmtDate(req.end_date!)}` : ''})`
              } else if (req.category === 'Budget') {
                summary = `$${req.details?.amount || 0} for ${req.details?.purpose || 'Budget'}`
              } else if (req.category === 'Equipment') {
                summary = `${req.details?.item_name || 'Item'} ($${req.details?.estimated_cost || 0})`
              } else if (req.category === 'Access') {
                summary = `${req.details?.system_name || 'System'} (${req.details?.role_required || 'Role'})`
              }

              return (
                <div key={req.id} className="req-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {req.category}: {req.type}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {summary}
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

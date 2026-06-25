'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createRequest } from '@/app/actions/requests'
import { addComment } from '@/app/actions/comments'
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
  priority: string
  attachment_url: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  decided_at: string | null
  decisions: { comment: string | null; approver_id: string }[]
  comments: { id: string; profile_id: string; text: string; created_at: string; profiles: { full_name: string }[] | { full_name: string } | null }[]
}

type Props = {
  user: { id: string; email: string }
  profile: { full_name: string; role: string }
  initialRequests: Request[]
}

const CATEGORIES = ['Time Off', 'Budget', 'Equipment', 'Access']
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent']
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
  return format(parseISO(d), 'MMM d, yyyy h:mm a')
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

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'Normal' || priority === 'Low') return null
  return (
    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ml-2" 
      style={{
        background: priority === 'Urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
        color: priority === 'Urgent' ? '#fca5a5' : '#fcd34d'
      }}>
      {priority}
    </span>
  )
}

function CommentThread({ reqId, comments }: { reqId: string, comments: Request['comments'] }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSubmitting(true)
    await addComment(reqId, text)
    setText('')
    setSubmitting(false)
  }

  const sorted = [...(comments || [])].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (!expanded && sorted.length === 0) {
    return (
      <button onClick={() => setExpanded(true)} className="text-xs text-slate-500 hover:text-slate-300 mt-2">
        + Add comment
      </button>
    )
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400">Discussion</span>
        {expanded && <button onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:text-slate-300">Hide</button>}
      </div>
      
      {expanded && (
        <div className="space-y-3 mb-3 max-h-40 overflow-y-auto pr-2">
          {sorted.map(c => (
            <div key={c.id} className="text-xs bg-white/5 rounded p-2">
              <div className="font-semibold text-slate-300 flex justify-between">
                <span>{(Array.isArray(c.profiles) ? c.profiles[0]?.full_name : c.profiles?.full_name) || 'User'}</span>
                <span className="text-slate-500 text-[10px]">{format(parseISO(c.created_at), 'MMM d, h:mm a')}</span>
              </div>
              <div className="text-slate-400 mt-0.5">{c.text}</div>
            </div>
          ))}
          {sorted.length === 0 && <div className="text-xs text-slate-500 italic">No comments yet.</div>}
        </div>
      )}

      {expanded && (
        <div className="flex gap-2">
          <input 
            type="text" 
            value={text} 
            onChange={e => setText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Write a comment..." 
            className="input-base text-xs py-1.5"
          />
          <button onClick={submit} disabled={submitting || !text.trim()} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
            Send
          </button>
        </div>
      )}
      
      {!expanded && sorted.length > 0 && (
        <button onClick={() => setExpanded(true)} className="text-xs text-slate-400 hover:text-slate-200">
          View {sorted.length} comment{sorted.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

export default function RequesterClient({ user, profile, initialRequests }: Props) {
  const [requests, setRequests] = useState<Request[]>(initialRequests)
  const [category, setCategory] = useState('Time Off')
  const [type, setType] = useState('Vacation')
  const [priority, setPriority] = useState('Normal')
  const [file, setFile] = useState<File | null>(null)
  
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

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('requester-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `requester_id=eq.${user.id}` },
        fetchRequests
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        fetchRequests
      )
      .subscribe()

    async function fetchRequests() {
      const { data } = await supabase
        .from('requests')
        .select(`
          id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at, decided_at, 
          decisions ( comment, approver_id ),
          comments ( id, profile_id, text, created_at, profiles(full_name) )
        `)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setRequests(data as unknown as Request[])
    }

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

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
      fd.set('priority', priority)
      fd.set('note', note)
      if (file) fd.set('file', file)
      
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
      
      setStartDate(''); setEndDate(''); setAmount(''); setPurpose(''); 
      setItemName(''); setEstimatedCost(''); setLink(''); 
      setSystemName(''); setRoleRequired(''); setNote('');
      setFile(null); setPriority('Normal');
      
      setSuccessMsg('Request submitted!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }, [category, type, priority, file, startDate, endDate, amount, purpose, itemName, estimatedCost, link, systemName, roleRequired, note])

  const days = startDate && endDate && endDate >= startDate ? dayCount(startDate, endDate) : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(24,95,165,0.12) 0%, #080d1a 55%)' }}>
      <div className="topbar">
        <div className="flex items-center gap-2.5">
          <div className="green-dot" />
          <span className="text-sm font-bold text-white tracking-tight">Nebula</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:block">{profile.full_name}</span>
          <div className="avatar">{initials(profile.full_name)}</div>
          <form action={signOut}>
            <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded">Sign out</button>
          </form>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        <div className="mb-2"><p className="section-label">New request</p></div>
        <div className="glass-card p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="input-base" style={{ cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111827' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className="input-base" style={{ cursor: 'pointer' }}>
                  {category === 'Time Off' && LEAVE_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Budget' && BUDGET_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Equipment' && EQUIPMENT_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                  {category === 'Access' && ACCESS_TYPES.map(t => <option key={t} value={t} style={{ background: '#111827' }}>{t}</option>)}
                </select>
              </div>
            </div>

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
                    {days} {days === 1 ? 'day' : 'days'} — {fmtDate(startDate)}{startDate !== endDate ? ` to ${fmtDate(endDate)}` : ''}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="input-base" style={{ cursor: 'pointer' }}>
                  {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#111827' }}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Attachment <span className="text-slate-600">(optional)</span></label>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="input-base py-1.5 text-xs file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-white/10 file:text-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Note <span className="text-slate-600">(optional)</span></label>
              <textarea rows={2} placeholder="Add context for your manager…" value={note} onChange={e => setNote(e.target.value)} className="input-base resize-none" />
            </div>

            {formError && <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{formError}</div>}
            {successMsg && <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">✓ {successMsg}</div>}

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </div>

        <div className="divider" />
        <div className="flex items-center justify-between mb-3">
          <p className="section-label mb-0">My requests</p>
          {requests.length > 0 && <span className="text-xs text-slate-500">{requests.length} total</span>}
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">No requests yet — submit one above ↑</div>
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
                    <div className="min-w-0 w-full">
                      <div className="text-sm font-semibold text-white flex items-center">
                        {req.category}: {req.type}
                        <PriorityBadge priority={req.priority} />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                        <span>{summary}</span>
                        <span>·</span>
                        <span className="text-slate-500">submitted {fmtDateFull(req.created_at)}</span>
                        {req.attachment_url && (
                          <>
                            <span>·</span>
                            <a href={req.attachment_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                              📎 View Attachment
                            </a>
                          </>
                        )}
                      </div>
                      {req.note && <div className="text-xs text-slate-500 mt-1.5 italic">"{req.note}"</div>}
                      
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

                      <CommentThread reqId={req.id} comments={req.comments} />
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

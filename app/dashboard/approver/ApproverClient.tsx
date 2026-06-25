'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveRequest, denyRequest } from '@/app/actions/requests'
import { addComment } from '@/app/actions/comments'
import { signOut } from '@/app/actions/auth'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'

type RequestComment = {
  id: string
  profile_id: string
  text: string
  created_at: string
  profiles: { full_name: string }[] | { full_name: string } | null
}

type PendingRequest = {
  id: string
  category: string
  type: string
  start_date: string | null
  end_date: string | null
  details: Record<string, string>
  note: string | null
  priority: string
  attachment_url: string | null
  status: string
  created_at: string
  profiles: { full_name: string }[] | { full_name: string } | null
  comments: RequestComment[]
}

type DecidedRequest = {
  id: string
  category: string
  type: string
  start_date: string | null
  end_date: string | null
  details: Record<string, string>
  priority: string
  attachment_url: string | null
  status: string
  decided_at: string | null
  profiles: { full_name: string }[] | { full_name: string } | null
  decisions: { comment: string | null }[]
  comments: RequestComment[]
}

type Props = {
  user: { id: string; email: string }
  profile: { full_name: string; role: string }
  initialPending: PendingRequest[]
  initialDecided: DecidedRequest[]
}

const CATEGORIES = ['Time Off', 'Budget', 'Equipment', 'Access']

function dayCount(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

function fmtDate(d: string) {
  return format(parseISO(d), 'MMM d')
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function RequesterAvatar({ name }: { name: string }) {
  const colors = [
    ['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.5)', '#a5b4fc'],
    ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.5)', '#fcd34d'],
    ['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.5)', '#6ee7b7'],
    ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.5)', '#fca5a5'],
    ['rgba(168,85,247,0.2)', 'rgba(168,85,247,0.5)', '#d8b4fe'],
  ]
  const idx = name.charCodeAt(0) % colors.length
  const [bg, border, color] = colors[idx]
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
      {initials(name)}
    </div>
  )
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

function CommentThread({ reqId, comments }: { reqId: string, comments: RequestComment[] }) {
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

function DenyModal({ requestId, requesterName, onClose, onDone }: { requestId: string, requesterName: string, onClose: () => void, onDone: () => void }) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDeny() {
    setLoading(true)
    await denyRequest(requestId, comment)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card p-6 w-full max-w-sm">
        <h2 className="text-base font-semibold text-white mb-1">Deny request</h2>
        <p className="text-xs text-slate-400 mb-4">Leaving a comment helps {requesterName} understand why.</p>
        <textarea
          id="deny-comment"
          rows={3}
          placeholder="Optional comment…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="input-base resize-none mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs py-2.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            id="confirm-deny"
            onClick={handleDeny}
            disabled={loading}
            className="flex-1 text-xs py-2.5 rounded-lg font-semibold"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}
          >
            {loading ? 'Denying…' : 'Deny request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatRequestSummary(req: { category: string, start_date: string | null, end_date: string | null, details: Record<string, string> }) {
  if (req.category === 'Time Off') {
    const dc = req.start_date && req.end_date ? dayCount(req.start_date, req.end_date) : 0
    let s = `${dc} ${dc === 1 ? 'day' : 'days'}`
    if (req.start_date) s += ` (${fmtDate(req.start_date)}${req.start_date !== req.end_date ? ` – ${fmtDate(req.end_date!)}` : ''})`
    return s
  } else if (req.category === 'Budget') {
    return `$${req.details?.amount || 0} for ${req.details?.purpose || 'Budget'}`
  } else if (req.category === 'Equipment') {
    return `${req.details?.item_name || 'Item'} ($${req.details?.estimated_cost || 0})`
  } else if (req.category === 'Access') {
    return `${req.details?.system_name || 'System'} (${req.details?.role_required || 'Role'})`
  }
  return 'Unknown'
}

export default function ApproverClient({ user, profile, initialPending, initialDecided }: Props) {
  const [pending, setPending] = useState<PendingRequest[]>(initialPending)
  const [decided, setDecided] = useState<DecidedRequest[]>(initialDecided)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [denyModal, setDenyModal] = useState<{ requestId: string; name: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('approver-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchAll)
      .subscribe()

    async function fetchAll() {
      const { data: p } = await supabase
        .from('requests')
        .select(`id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at, profiles ( full_name ), comments ( id, profile_id, text, created_at, profiles(full_name) )`)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      const { data: d } = await supabase
        .from('requests')
        .select(`id, category, type, start_date, end_date, details, priority, attachment_url, status, decided_at, profiles ( full_name ), decisions ( comment ), comments ( id, profile_id, text, created_at, profiles(full_name) )`)
        .in('status', ['approved', 'denied'])
        .order('decided_at', { ascending: false })
        .limit(15)

      if (p) setPending(p as unknown as PendingRequest[])
      if (d) setDecided(d as unknown as DecidedRequest[])
    }

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  async function handleApprove(id: string) {
    setActionLoading(id + '-approve')
    await approveRequest(id)
    setActionLoading(null)
  }

  return (
    <>
      {denyModal && (
        <DenyModal
          requestId={denyModal.requestId}
          requesterName={denyModal.name}
          onClose={() => setDenyModal(null)}
          onDone={() => setDenyModal(null)}
        />
      )}

      <div className="min-h-screen flex flex-col"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.08) 0%, #080d1a 55%)' }}>
        <div className="topbar">
          <div className="flex items-center gap-2.5">
            <div className="green-dot" />
            <span className="text-sm font-bold text-white tracking-tight">Nebula</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:block">{profile.full_name}</span>
            <div className="avatar" style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}>
              {initials(profile.full_name)}
            </div>
            <form action={signOut}>
              <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded">Sign out</button>
            </form>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-auto w-full px-4 py-8">

          <div className="mb-6">
            <p className="text-xl font-bold text-white mb-1">Pending approvals</p>
            <p className="text-sm text-slate-400">Review and act on requests from your team.</p>
          </div>

          {pending.length === 0 ? (
            <div className="glass-card p-8 text-center mb-6">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-slate-400">All caught up — no pending requests.</p>
            </div>
          ) : (
            <div className="space-y-8 mb-6">
              {CATEGORIES.map(category => {
                const catPending = pending.filter(r => r.category === category)
                // Sort to put Urgent requests at top
                catPending.sort((a,b) => {
                  if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1
                  if (b.priority === 'Urgent' && a.priority !== 'Urgent') return 1
                  return 0
                })
                
                if (catPending.length === 0) return null

                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                      <p className="section-label mb-0" style={{ color: '#fff', fontSize: '0.95rem' }}>{category}</p>
                      <span className="count-pill">{catPending.length}</span>
                    </div>
                    <div className="space-y-3">
                      {catPending.map(req => {
                        const rawProfile = req.profiles
                        const name = (Array.isArray(rawProfile) ? rawProfile[0]?.full_name : rawProfile?.full_name) ?? 'Unknown'
                        const isApprovingThis = actionLoading === req.id + '-approve'
                        const summary = formatRequestSummary(req)

                        return (
                          <div key={req.id} className="req-card">
                            <div className="flex items-start gap-3">
                              <RequesterAvatar name={name} />
                              <div className="flex-1 min-w-0 w-full">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-white flex items-center">
                                      {name}
                                      <PriorityBadge priority={req.priority} />
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                                      <span>{req.type}</span>
                                      <span>·</span>
                                      <span>{summary}</span>
                                    </div>
                                    {req.note && (
                                      <div className="text-xs text-slate-500 mt-1.5 italic">"{req.note}"</div>
                                    )}
                                    <div className="flex flex-wrap gap-x-3 mt-1.5">
                                      {req.details?.link && (
                                        <a href={req.details.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                                          ↗ URL Link
                                        </a>
                                      )}
                                      {req.attachment_url && (
                                        <a href={req.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                                          📎 View Attachment
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <span className="badge badge-pending shrink-0">New</span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <button onClick={() => handleApprove(req.id)} disabled={!!actionLoading} className="btn-approve">
                                    {isApprovingThis ? '…' : '✓'} Approve
                                  </button>
                                  <button onClick={() => setDenyModal({ requestId: req.id, name })} disabled={!!actionLoading} className="btn-deny">
                                    ✕ Deny
                                  </button>
                                </div>
                                
                                <CommentThread reqId={req.id} comments={req.comments} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {decided.length > 0 && (
            <>
              <div className="divider" />
              <p className="text-lg font-bold text-white mb-4">Recently decided</p>
              <div className="space-y-8">
                {CATEGORIES.map(category => {
                  const catDecided = decided.filter(r => r.category === category)
                  if (catDecided.length === 0) return null

                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{category}</p>
                      </div>
                      <div className="space-y-2.5">
                        {catDecided.map(req => {
                          const rawProfile2 = req.profiles
                          const name = (Array.isArray(rawProfile2) ? rawProfile2[0]?.full_name : rawProfile2?.full_name) ?? 'Unknown'
                          const summary = formatRequestSummary(req)
                          const comment = req.decisions?.[0]?.comment

                          return (
                            <div key={req.id} className="req-card" style={{ opacity: 0.75 }}>
                              <div className="flex items-start gap-3">
                                <RequesterAvatar name={name} />
                                <div className="flex-1 min-w-0 w-full">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-medium text-slate-200 flex items-center">
                                        {name}
                                        <PriorityBadge priority={req.priority} />
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {req.type} · {summary}
                                      </div>
                                      {comment && (
                                        <div className="text-xs text-slate-600 mt-1 italic">"{comment}"</div>
                                      )}
                                    </div>
                                    <span className={`badge ${req.status === 'approved' ? 'badge-approved' : 'badge-denied'} shrink-0`}>
                                      {req.status === 'approved' ? '✓ Approved' : '✕ Denied'}
                                    </span>
                                  </div>
                                  
                                  <CommentThread reqId={req.id} comments={req.comments} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

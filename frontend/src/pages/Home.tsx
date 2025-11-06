import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../api/client'

type Drop = {
  id: number
  title: string
  description?: string | null
  starts_at: string
  claim_window_start: string
  claim_window_end: string
  stock: number
  is_active: boolean
  joined?: boolean
  claimed?: boolean
}

function isWithinClaimWindow(d: Drop): boolean {
  const now = new Date().getTime()
  const start = new Date(d.claim_window_start).getTime()
  const end = new Date(d.claim_window_end).getTime()
  return now >= start && now <= end
}

export function Home() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
    }
  }, [token, navigate])

  function logout() {
    localStorage.removeItem('access_token')
    navigate('/login', { replace: true })
  }

  const [drops, setDrops] = useState<Drop[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [claimCodes, setClaimCodes] = useState<Record<number, string>>({})
  const headersToken = useMemo(() => token ?? undefined, [token])

  async function loadDrops() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Drop[]>('/drops', headersToken)
      setDrops(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load drops')
    } finally {
      setLoading(false)
    }
  }

  async function join(dropId: number) {
    if (!headersToken) return navigate('/login')
    // optimistic UI
    setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: true } : d))
    try {
      await apiPost(`/drops/${dropId}/join`, {}, headersToken)
      setInfo('Joined waitlist')
    } catch (e: any) {
      // rollback on error
      setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: false } : d))
      setError(e.message || 'Failed to join')
    } finally {
      await loadDrops()
      setTimeout(() => setInfo(null), 1500)
    }
  }

  async function leave(dropId: number) {
    if (!headersToken) return navigate('/login')
    // optimistic UI
    setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: false } : d))
    try {
      await apiPost(`/drops/${dropId}/leave`, {}, headersToken)
      setInfo('Left waitlist')
    } catch (e: any) {
      // rollback on error
      setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: true } : d))
      setError(e.message || 'Failed to leave')
    } finally {
      await loadDrops()
      setTimeout(() => setInfo(null), 1500)
    }
  }

  async function claim(dropId: number) {
    if (!headersToken) return navigate('/login')
    setError(null)
    try {
      const res = await apiPost<{ code: string }>(`/drops/${dropId}/claim`, {}, headersToken)
      setClaimCodes(prev => ({ ...prev, [dropId]: res.code }))
      setInfo('Claim successful')
      setDrops(prev => prev.map(d => d.id === dropId ? { ...d, claimed: true } : d))
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Claim failed')
    }
  }

  useEffect(() => {
    loadDrops()
  }, [])

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">DropSpot</h1>
        <button onClick={logout} className="btn btn-secondary">Logout</button>
      </header>

      <section className="card p-6 mb-6">
        <h2 className="text-xl font-medium mb-2">Welcome</h2>
        <p className="text-slate-300">You are logged in. Upcoming work: drops list and join/leave actions.</p>
      </section>

      {info && (
        <div className="mb-2 text-sm text-emerald-300">{info}</div>
      )}
      {error && (
        <div className="mb-4 text-sm text-red-400">{error}</div>
      )}

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Active Drops</h3>
          <button onClick={loadDrops} className="btn btn-secondary">Refresh</button>
        </div>
        {loading ? (
          <div className="text-slate-300">Loading...</div>
        ) : drops.length === 0 ? (
          <div className="text-slate-400">No drops yet</div>
        ) : (
          <ul className="grid gap-3">
            {drops.map(d => (
              <li key={d.id} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {d.title}
                      {d.claimed && (
                        <span className="text-xs px-2 py-1 rounded bg-emerald-600/30 border border-emerald-500 text-emerald-300">Claimed</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-sm">Stock: {d.stock}</div>
                    {claimCodes[d.id] && (
                      <div className="text-emerald-300 text-sm mt-1">Code: <span className="font-mono">{claimCodes[d.id]}</span></div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => join(d.id)} disabled={d.joined || d.claimed}>
                      {d.joined ? 'Joined' : 'Join'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => leave(d.id)} disabled={!d.joined || d.claimed}>
                      Leave
                    </button>
                    <button className="btn btn-primary" onClick={() => claim(d.id)} disabled={!d.joined || d.claimed || !isWithinClaimWindow(d)}>
                      Claim
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}



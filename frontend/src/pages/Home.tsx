import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'

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
  claim_code?: string | null
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
  const [claimedDrops, setClaimedDrops] = useState<Drop[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
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

  async function loadClaimedDrops() {
    if (!headersToken) return
    try {
      const claimed = await apiGet<Drop[]>('/drops/claimed', headersToken)
      setClaimedDrops(claimed)
    } catch (e) {
      // Ignore if no claims or error
      setClaimedDrops([])
    }
  }

  async function join(dropId: number) {
    if (!headersToken) return navigate('/login')
    // optimistic UI
    setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: true } : d))
    try {
      await apiPost(`/drops/${dropId}/join`, {}, headersToken)
      setInfo('Joined waitlist')
      await loadDrops() // Refresh drops (claimed drops doesn't change)
    } catch (e: any) {
      // rollback on error
      setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: false } : d))
      setError(e.message || 'Failed to join')
    } finally {
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
      await loadDrops() // Refresh drops (claimed drops doesn't change)
    } catch (e: any) {
      // rollback on error
      setDrops(prev => prev.map(d => d.id === dropId ? { ...d, joined: true } : d))
      setError(e.message || 'Failed to leave')
    } finally {
      setTimeout(() => setInfo(null), 1500)
    }
  }

  async function claim(dropId: number) {
    if (!headersToken) return navigate('/login')
    setError(null)
    try {
      await apiPost<{ code: string }>(`/drops/${dropId}/claim`, {}, headersToken)
      setInfo('Claim successful')
      await Promise.all([loadDrops(), loadClaimedDrops()]) // Both need to update after claim
    } catch (e: any) {
      setError(e.message || 'Claim failed')
    }
  }

  useEffect(() => {
    loadDrops()
    loadClaimedDrops() // Load claimed drops only on initial mount
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">DropSpot</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={logout} className="btn btn-secondary bg-red-600 hover:bg-red-700 text-white border-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:border-red-700">Logout</button>
          </div>
        </header>

      {info && (
        <div className="mb-4 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">{info}</div>
      )}
      {error && (
        <div className="mb-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">{error}</div>
      )}

      <section className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Active Drops</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Join waitlists and claim your drops</p>
          </div>
          <button onClick={loadDrops} className="btn btn-secondary">Refresh</button>
        </div>
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</div>
        ) : drops.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-12">No drops available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drops.map(d => (
              <div key={d.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 hover:shadow-md transition-all">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">{d.title}</h4>
                    {d.claimed && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium">Claimed</span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{d.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>Stock: {d.stock}</span>
                  </div>
                  {d.claim_code && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">📋 Copy your one-time claim code:</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-green-700 dark:text-green-400 flex-1 break-all">{d.claim_code}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(d.claim_code || '')
                            setInfo('Code copied!')
                            setTimeout(() => setInfo(null), 2000)
                          }}
                          className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded border border-green-300 dark:border-green-700 transition-colors"
                          title="Copy code"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {!d.joined && !d.claimed && (
                    <button className="btn btn-primary w-full" onClick={() => join(d.id)}>
                      Join Waitlist
                    </button>
                  )}
                  {d.joined && !d.claimed && (
                    <>
                      {isWithinClaimWindow(d) ? (
                        <button className="btn btn-primary w-full" onClick={() => claim(d.id)}>
                          Claim Now
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">Claim window not open</div>
                      )}
                      <button className="btn btn-secondary w-full text-sm" onClick={() => leave(d.id)}>
                        Leave Waitlist
                      </button>
                    </>
                  )}
                  {d.claimed && (
                    <div className="text-center py-2">
                      <span className="text-green-700 dark:text-green-400 text-sm font-medium">✓ Claimed</span>
                    </div>
                  )}
                  <button className="btn btn-secondary w-full text-sm" onClick={() => navigate(`/drops/${d.id}`)}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {claimedDrops.length > 0 && (
        <section className="card p-6 mt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Your Claimed Drops</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {claimedDrops.map(d => (
              <div key={d.id} className="border border-green-200 dark:border-green-800 rounded-lg p-5 bg-green-50/50 dark:bg-green-900/20 hover:shadow-md transition-all">
                <div className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">{d.title}</h4>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium">Claimed</span>
                  </div>
                  {d.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{d.description}</p>
                  )}
                  <div className="text-gray-600 dark:text-gray-400 text-sm mb-3">Stock: {d.stock}</div>
                  {d.claim_code && (
                    <div className="p-3 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-lg">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">📋 Copy your one-time claim code:</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono font-bold text-green-700 dark:text-green-400 text-lg flex-1 break-all">{d.claim_code}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(d.claim_code || '')
                            setInfo('Code copied!')
                            setTimeout(() => setInfo(null), 2000)
                          }}
                          className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded border border-green-300 dark:border-green-700 transition-colors"
                          title="Copy code"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="btn btn-secondary w-full text-sm mt-3" onClick={() => navigate(`/drops/${d.id}`)}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  )
}



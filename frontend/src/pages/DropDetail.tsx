import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

export function DropDetail() {
  const { id } = useParams<{ id: string }>()
  const dropId = Number(id)
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const headersToken = useMemo(() => token ?? undefined, [token])

  const [drop, setDrop] = useState<Drop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function loadDetail() {
    if (!Number.isFinite(dropId)) {
      setError('Invalid drop id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      let selected: Drop | null = null
      let claimCodeFromClaimed: string | null = null
      
      // First, try to get from active drops
      try {
        const drops = await apiGet<Drop[]>('/drops', headersToken)
        selected = drops.find(d => d.id === dropId) || null
      } catch (err) {
        // If not found in active drops, might be inactive
      }

      // If authenticated, always check claimed drops to get accurate claim_code
      if (headersToken) {
        try {
          const claimedDrops = await apiGet<Drop[]>('/drops/claimed', headersToken)
          const claimedMatch = claimedDrops.find(c => c.id === dropId)
          
          if (claimedMatch) {
            // User has claimed this drop - use claim_code from claimed endpoint (most reliable)
            claimCodeFromClaimed = claimedMatch.claim_code || null
            
            if (selected) {
              // Drop is active and claimed - merge data, prioritize claim_code from claimed endpoint
              selected.claimed = true
              // Always use claim_code from /drops/claimed endpoint as it's more reliable
              selected.claim_code = claimCodeFromClaimed || selected.claim_code || null
            } else {
              // Drop is inactive but user has claimed it - use claimed drop data
              selected = { ...claimedMatch, claimed: true, claim_code: claimCodeFromClaimed }
            }
          } else if (selected) {
            // Drop is active but not claimed by user
            selected.claimed = selected.claimed || false
            // Keep claim_code from /drops endpoint if it exists (might be from cache or previous state)
            // But if drop is not in claimed list, clear it
            if (!selected.claimed) {
              selected.claim_code = null
            }
          }
        } catch (err) {
          // Ignore claimed fetch error; not critical for viewing details
        }
      }

      if (!selected) {
        setError('Drop not found')
        setDrop(null)
        return
      }

      // Final check: if drop is marked as claimed but claim_code is missing, try to get it
      if (selected.claimed && !selected.claim_code && claimCodeFromClaimed) {
        selected.claim_code = claimCodeFromClaimed
      }
      
      // If still no claim_code but drop is claimed, it might be in the original /drops response
      // Keep it if it exists

      setDrop(selected)
    } catch (err: any) {
      setError(err?.message || 'Failed to load drop')
      setDrop(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropId, headersToken])

  function requireAuth(action: () => void) {
    if (!headersToken) {
      navigate('/login')
      return
    }
    action()
  }

  async function join() {
    requireAuth(async () => {
      if (!drop) return
      setDrop(prev => (prev ? { ...prev, joined: true } : prev))
      setInfo(null)
      try {
        await apiPost(`/drops/${dropId}/join`, {}, headersToken)
        setInfo('Joined waitlist')
        await loadDetail()
      } catch (err: any) {
        setError(err?.message || 'Failed to join')
        setDrop(prev => (prev ? { ...prev, joined: false } : prev))
      } finally {
        setTimeout(() => setInfo(null), 1500)
      }
    })
  }

  async function leave() {
    requireAuth(async () => {
      if (!drop) return
      setDrop(prev => (prev ? { ...prev, joined: false } : prev))
      setInfo(null)
      try {
        await apiPost(`/drops/${dropId}/leave`, {}, headersToken)
        setInfo('Left waitlist')
        await loadDetail()
      } catch (err: any) {
        setError(err?.message || 'Failed to leave')
        setDrop(prev => (prev ? { ...prev, joined: true } : prev))
      } finally {
        setTimeout(() => setInfo(null), 1500)
      }
    })
  }

  async function claim() {
    requireAuth(async () => {
      if (!drop) return
      setError(null)
      try {
        const result = await apiPost<{ code: string }>(`/drops/${dropId}/claim`, {}, headersToken)
        const code = result?.code
        setInfo('Claim successful')
        setDrop(prev => (prev ? { ...prev, claimed: true, claim_code: code ?? prev.claim_code } : prev))
        await loadDetail()
      } catch (err: any) {
        setError(err?.message || 'Claim failed')
      }
    })
  }

  function renderActions() {
    if (!drop) {
      return <div className="text-sm text-gray-500">Drop not found</div>
    }

    // If drop is claimed, always show claim code (even if inactive)
    if (drop.claimed) {
      return (
        <div className="space-y-3">
          <div className="text-sm text-green-700 dark:text-green-400">You already claimed this drop.</div>
          {!drop.is_active && (
            <div className="text-xs text-gray-500 dark:text-gray-400">This drop is now inactive.</div>
          )}
          {drop.claim_code && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">📋 Copy your one-time claim code:</div>
              <div className="flex items-center gap-2">
                <div className="font-mono font-bold text-green-700 dark:text-green-400 text-lg flex-1 break-all">{drop.claim_code}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(drop.claim_code || '')
                    setInfo('Code copied to clipboard!')
                    setTimeout(() => setInfo(null), 2000)
                  }}
                  className="px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded border border-green-300 dark:border-green-700 transition-colors"
                  title="Copy code"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    // If drop is inactive and not claimed, show inactive message
    if (!drop.is_active) {
      return <div className="text-sm text-gray-500">Drop is inactive</div>
    }

    if (drop.joined) {
      return (
        <div className="space-y-3">
          {isWithinClaimWindow(drop) ? (
            <button className="btn btn-primary w-full" onClick={claim}>
              Claim Now
            </button>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Claim window not open yet.
            </div>
          )}
          <button className="btn btn-secondary w-full text-sm" onClick={leave}>
            Leave Waitlist
          </button>
        </div>
      )
    }

    return (
      <button className="btn btn-primary w-full" onClick={join}>
        Join Waitlist
      </button>
    )
  }

  function formatDate(value: string) {
    try {
      return new Date(value).toLocaleString()
    } catch (err) {
      return value
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Drop Details</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Review drop information and manage your waitlist status</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => navigate(-1)} className="btn btn-secondary">Back</button>
          </div>
        </header>

        {info && (
          <div className="mb-4 text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            {info}
          </div>
        )}

        {error && (
          <div className="mb-4 text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card p-8 text-center text-gray-500 dark:text-gray-400">Loading drop details...</div>
        ) : drop ? (
          <div className="card p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{drop.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drop #{drop.id}</p>
                </div>

                {drop.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Description</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400 leading-relaxed">{drop.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Drop Starts</div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">{formatDate(drop.starts_at)}</div>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Claim Window</div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                      <span className="block">Start: {formatDate(drop.claim_window_start)}</span>
                      <span className="block">End: {formatDate(drop.claim_window_end)}</span>
                    </div>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stock</div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">{drop.stock}</div>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                      {drop.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-sm">
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 bg-gray-50 dark:bg-gray-800/60 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Actions</h3>
                  {renderActions()}
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <p>Claim window must be open and you must be in the top priority users to claim.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-gray-500 dark:text-gray-400">Drop not found.</div>
        )}
      </div>
    </div>
  )
}



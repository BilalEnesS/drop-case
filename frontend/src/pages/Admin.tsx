import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client'
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
}

export function Admin() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
  const headersToken = useMemo(() => token ?? undefined, [token])

  if (!token || role !== 'admin') {
    navigate('/login', { replace: true })
  }

  const [drops, setDrops] = useState<Drop[]>([])
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Drop | null>(null)
  const [viewingWaitlist, setViewingWaitlist] = useState<number | null>(null)
  const [waitlistData, setWaitlistData] = useState<any>(null)

  // Create form state
  const [title, setTitle] = useState('New Drop')
  const [description, setDescription] = useState('')
  const [stock, setStock] = useState(100)
  const [offsetStartMin, setOffsetStartMin] = useState(10)
  const [offsetWindowStartMin, setOffsetWindowStartMin] = useState(15)
  const [offsetWindowEndMin, setOffsetWindowEndMin] = useState(45)
  const [suggesting, setSuggesting] = useState(false)

  async function loadDrops() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Drop[]>('/admin/drops', headersToken)
      console.log('Loaded drops:', data)
      setDrops(data)
    } catch (e: any) {
      console.error('Load drops error:', e)
      setError(e.message || 'Failed to load drops')
    } finally {
      setLoading(false)
    }
  }

  async function suggestDescription() {
    if (!title || title.trim() === '') {
      setError('Please enter a title first')
      return
    }
    setSuggesting(true)
    setError(null)
    try {
      const response = await apiPost<{ description: string }>('/admin/drops/suggest-description', { title }, headersToken)
      setDescription(response.description)
      setInfo('Description suggested!')
    } catch (e: any) {
      setError(e.message || 'Failed to suggest description')
    } finally {
      setSuggesting(false)
    }
  }

  async function createDrop(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const now = new Date()
      const payload = {
        title,
        description: description || null,
        starts_at: new Date(now.getTime() + offsetStartMin * 60000).toISOString(),
        claim_window_start: new Date(now.getTime() + offsetWindowStartMin * 60000).toISOString(),
        claim_window_end: new Date(now.getTime() + offsetWindowEndMin * 60000).toISOString(),
        stock,
        is_active: true,
      }
      await apiPost('/admin/drops', payload, headersToken)
      setInfo('Drop created')
      setTitle('New Drop')
      setDescription('')
      setStock(100)
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Create failed')
    }
  }

  async function activateDrop(drop: Drop) {
    setError(null)
    try {
      const now = new Date()
      const claimWindowEnd = drop.claim_window_end ? new Date(drop.claim_window_end) : null
      
      // If claim window has expired, extend it to future
      const updates: Partial<Drop> = { is_active: true }
      if (claimWindowEnd && claimWindowEnd < now) {
        // Extend claim window to 24 hours from now
        const newEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        updates.claim_window_end = newEnd.toISOString()
        setInfo('Drop activated and claim window extended')
      } else {
        setInfo('Drop activated')
      }
      
      await apiPut<Drop>(`/admin/drops/${drop.id}`, updates, headersToken)
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Activate failed')
    }
  }

  async function updateDrop(dropId: number, updates: Partial<Drop>) {
    setError(null)
    try {
      await apiPut<Drop>(`/admin/drops/${dropId}`, updates, headersToken)
      setInfo('Drop updated')
      setEditing(null)
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Update failed')
    }
  }

  async function deleteDrop(dropId: number) {
    if (!confirm('Delete this drop?')) return
    setError(null)
    try {
      await apiDelete(`/admin/drops/${dropId}`, headersToken)
      setInfo('Drop deleted')
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Delete failed')
    }
  }

  async function loadWaitlist(dropId: number) {
    setError(null)
    try {
      const data = await apiGet<any>(`/admin/drops/${dropId}/waitlist`, headersToken)
      setWaitlistData(data)
      setViewingWaitlist(dropId)
    } catch (e: any) {
      setError(e.message || 'Failed to load waitlist')
    }
  }

  useEffect(() => {
    if (token && role === 'admin') {
      loadDrops()
    }
  }, [token, role])

  const activeDrops = drops.filter(d => d.is_active)
  const inactiveDrops = drops.filter(d => !d.is_active)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Admin Panel</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage drops and view waitlists</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => navigate('/')} className="btn btn-secondary">Back to Home</button>
          </div>
        </header>

        {info && <div className="mb-4 text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">{info}</div>}
        {error && <div className="mb-4 text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="card p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Active Drops</h2>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">{activeDrops.length} active drops</span>
                <button onClick={loadDrops} className="btn btn-secondary text-sm" disabled={loading}>Refresh</button>
              </div>
              {loading ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading...</div>
              ) : activeDrops.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">No active drops</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDrops.map(d => (
                    <div key={d.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{d.title}</h3>
                          {d.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{d.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <span>Stock: {d.stock}</span>
                            <span>•</span>
                            <span>ID: {d.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary text-xs px-3 py-1.5" onClick={() => loadWaitlist(d.id)}>Waitlist</button>
                        <button className="btn btn-secondary text-xs px-3 py-1.5" onClick={() => setEditing(d)}>Edit</button>
                        <button className="btn btn-secondary text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => deleteDrop(d.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Inactive Drops</h2>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">{inactiveDrops.length} inactive drops</span>
              </div>
              {inactiveDrops.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">No inactive drops</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inactiveDrops.map(d => (
                    <div key={d.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{d.title}</h3>
                          {d.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{d.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                            <span>Stock: {d.stock}</span>
                            <span>•</span>
                            <span>ID: {d.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary text-xs px-3 py-1.5" onClick={() => activateDrop(d)}>Activate</button>
                        <button className="btn btn-secondary text-xs px-3 py-1.5" onClick={() => setEditing(d)}>Edit</button>
                        <button className="btn btn-secondary text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => deleteDrop(d.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Create New Drop</h2>
              <form onSubmit={createDrop} className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Title</span>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </label>
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Description</span>
                    <button
                      type="button"
                      onClick={suggestDescription}
                      disabled={suggesting || !title}
                      className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {suggesting ? 'Suggesting...' : '✨ AI Suggest'}
                    </button>
                  </div>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description or use AI to suggest one..."
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Stock</span>
                  <input className="input" type="number" value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} min={0} />
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Start (minutes from now)</span>
                    <input className="input" type="number" value={offsetStartMin} onChange={(e) => setOffsetStartMin(parseInt(e.target.value || '0'))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window Start (minutes from now)</span>
                    <input className="input" type="number" value={offsetWindowStartMin} onChange={(e) => setOffsetWindowStartMin(parseInt(e.target.value || '0'))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window End (minutes from now)</span>
                    <input className="input" type="number" value={offsetWindowEndMin} onChange={(e) => setOffsetWindowEndMin(parseInt(e.target.value || '0'))} />
                  </label>
                </div>
                <button className="btn btn-primary w-full" type="submit">Create Drop</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Edit Drop</h3>
            <EditForm
              drop={editing}
              onSave={(updates) => updateDrop(editing.id, updates)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {viewingWaitlist && waitlistData && (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Waitlist</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{waitlistData.drop_title}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setViewingWaitlist(null); setWaitlistData(null) }}>Close</button>
            </div>
            <div className="mb-6 flex items-center gap-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                Stock: {waitlistData.stock}
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg">
                Waitlist: {waitlistData.waitlist_count} users
              </div>
            </div>
            {waitlistData.waitlist.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-12">No users in waitlist</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Rank</th>
                      <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Email</th>
                      <th className="text-right p-3 text-gray-700 dark:text-gray-300 font-semibold">Priority</th>
                      <th className="text-right p-3 text-gray-700 dark:text-gray-300 font-semibold">Account Age</th>
                      <th className="text-right p-3 text-gray-700 dark:text-gray-300 font-semibold">Actions</th>
                      <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Joined</th>
                      <th className="text-center p-3 text-gray-700 dark:text-gray-300 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistData.waitlist.map((item: any) => (
                      <tr key={item.user_id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${item.rank <= waitlistData.stock ? 'bg-green-50/50 dark:bg-green-900/20' : ''}`}>
                        <td className="p-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${item.rank <= waitlistData.stock ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                            {item.rank}
                          </span>
                        </td>
                        <td className="p-3 text-gray-800 dark:text-gray-200">{item.email}</td>
                        <td className="p-3 text-right">
                          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{item.priority_score}</span>
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400">{item.account_age_days}d</td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400">{item.rapid_actions}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">{new Date(item.joined_at).toLocaleString()}</td>
                        <td className="p-3 text-center">
                          {item.rank <= waitlistData.stock ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                              ✓ Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                              Waiting
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EditForm({ drop, onSave, onCancel }: { drop: Drop; onSave: (updates: Partial<Drop>) => void; onCancel: () => void }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const headersToken = useMemo(() => token ?? undefined, [token])
  const [title, setTitle] = useState(drop.title)
  const [description, setDescription] = useState(drop.description || '')
  const [stock, setStock] = useState(drop.stock)
  const [isActive, setIsActive] = useState(drop.is_active)
  const [suggesting, setSuggesting] = useState(false)

  async function suggestDescription() {
    if (!title || title.trim() === '') {
      return
    }
    setSuggesting(true)
    try {
      const response = await apiPost<{ description: string }>('/admin/drops/suggest-description', { title }, headersToken)
      setDescription(response.description)
    } catch (e: any) {
      // Silent fail
    } finally {
      setSuggesting(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ title, description: description || null, stock, is_active: isActive })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Description</span>
          <button
            type="button"
            onClick={suggestDescription}
            disabled={suggesting || !title}
            className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggesting ? 'Suggesting...' : '✨ AI Suggest'}
          </button>
        </div>
        <textarea
          className="input min-h-[80px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description or use AI to suggest one..."
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Stock</span>
        <input className="input" type="number" value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} min={0} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Active</span>
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit">Save</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

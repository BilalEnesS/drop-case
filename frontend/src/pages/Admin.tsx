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
  const [activeTab, setActiveTab] = useState<'drops' | 'users'>('drops')
  
  // Users management state
  const [users, setUsers] = useState<any[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user')

  // Create form state
  const [title, setTitle] = useState('New Drop')
  const [description, setDescription] = useState('')
  const [stock, setStock] = useState(100)
  const [startsAt, setStartsAt] = useState('')
  const [claimWindowStart, setClaimWindowStart] = useState('')
  const [claimWindowEnd, setClaimWindowEnd] = useState('')
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

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<any[]>('/admin/users', headersToken)
      setUsers(data)
    } catch (e: any) {
      console.error('Load users error:', e)
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('role')
    navigate('/login', { replace: true })
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiPost('/admin/users', {
        email: userEmail,
        password: userPassword,
        role: userRole
      }, headersToken)
      setInfo('User created')
      setUserEmail('')
      setUserPassword('')
      setUserRole('user')
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Failed to create user')
    }
  }

  async function updateUserRole(userId: number, newRole: 'user' | 'admin') {
    setError(null)
    try {
      await apiPut(`/admin/users/${userId}/role`, { role: newRole }, headersToken)
      setInfo('User role updated')
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Failed to update user role')
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm('Delete this user?')) return
    setError(null)
    try {
      await apiDelete(`/admin/users/${userId}`, headersToken)
      setInfo('User deleted')
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Failed to delete user')
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
      const payload = {
        title,
        description: description || null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
        claim_window_start: claimWindowStart ? new Date(claimWindowStart).toISOString() : new Date().toISOString(),
        claim_window_end: claimWindowEnd ? new Date(claimWindowEnd).toISOString() : new Date().toISOString(),
        stock,
        is_active: true,
      }
      await apiPost('/admin/drops', payload, headersToken)
      setInfo('Drop created')
      setTitle('New Drop')
      setDescription('')
      setStock(100)
      setStartsAt('')
      setClaimWindowStart('')
      setClaimWindowEnd('')
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
      if (activeTab === 'drops') {
        loadDrops()
      } else if (activeTab === 'users') {
        loadUsers()
      }
    }
  }, [token, role, activeTab])

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
            <button onClick={logout} className="btn btn-secondary bg-red-600 hover:bg-red-700 text-white border-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:border-red-700">Logout</button>
          </div>
        </header>

        {info && <div className="mb-4 text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">{info}</div>}
        {error && <div className="mb-4 text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('drops')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'drops'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Drops
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Users
          </button>
        </div>

        {activeTab === 'drops' && (
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
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Start Date & Time</span>
                    <input 
                      className="input" 
                      type="datetime-local" 
                      value={startsAt} 
                      onChange={(e) => setStartsAt(e.target.value)} 
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window Start</span>
                    <input 
                      className="input" 
                      type="datetime-local" 
                      value={claimWindowStart} 
                      onChange={(e) => setClaimWindowStart(e.target.value)} 
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window End</span>
                    <input 
                      className="input" 
                      type="datetime-local" 
                      value={claimWindowEnd} 
                      onChange={(e) => setClaimWindowEnd(e.target.value)} 
                      required
                    />
                  </label>
                </div>
                <button className="btn btn-primary w-full" type="submit">Create Drop</button>
              </form>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Users</h2>
                <button onClick={loadUsers} className="btn btn-secondary text-sm" disabled={loading}>Refresh</button>
              </div>
              {loading ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading...</div>
              ) : users.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">No users</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">ID</th>
                        <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Email</th>
                        <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Role</th>
                        <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="p-3 text-gray-800 dark:text-gray-200">{user.id}</td>
                          <td className="p-3 text-gray-800 dark:text-gray-200">{user.email}</td>
                          <td className="p-3">
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as 'user' | 'admin')}
                              className="input text-sm py-1 px-2"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="btn btn-secondary text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Create New User</h2>
              <form onSubmit={createUser} className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Email</span>
                  <input
                    className="input"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Password</span>
                  <input
                    className="input"
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Role</span>
                  <select
                    className="input"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as 'user' | 'admin')}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button className="btn btn-primary w-full" type="submit">Create User</button>
              </form>
            </div>
          </div>
        </div>
        )}
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
  const [startsAt, setStartsAt] = useState(() => {
    if (drop.starts_at) {
      const d = new Date(drop.starts_at)
      return d.toISOString().slice(0, 16)
    }
    return ''
  })
  const [claimWindowStart, setClaimWindowStart] = useState(() => {
    if (drop.claim_window_start) {
      const d = new Date(drop.claim_window_start)
      return d.toISOString().slice(0, 16)
    }
    return ''
  })
  const [claimWindowEnd, setClaimWindowEnd] = useState(() => {
    if (drop.claim_window_end) {
      const d = new Date(drop.claim_window_end)
      return d.toISOString().slice(0, 16)
    }
    return ''
  })
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
    const updates: Partial<Drop> = {
      title,
      description: description || null,
      stock,
      is_active: isActive
    }
    if (startsAt) {
      updates.starts_at = new Date(startsAt).toISOString()
    }
    if (claimWindowStart) {
      updates.claim_window_start = new Date(claimWindowStart).toISOString()
    }
    if (claimWindowEnd) {
      updates.claim_window_end = new Date(claimWindowEnd).toISOString()
    }
    onSave(updates)
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
      <label className="grid gap-1">
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Start Date & Time</span>
        <input 
          className="input" 
          type="datetime-local" 
          value={startsAt} 
          onChange={(e) => setStartsAt(e.target.value)} 
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window Start</span>
        <input 
          className="input" 
          type="datetime-local" 
          value={claimWindowStart} 
          onChange={(e) => setClaimWindowStart(e.target.value)} 
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Claim Window End</span>
        <input 
          className="input" 
          type="datetime-local" 
          value={claimWindowEnd} 
          onChange={(e) => setClaimWindowEnd(e.target.value)} 
        />
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

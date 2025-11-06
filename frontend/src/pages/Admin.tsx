import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client'

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

  // Create form state
  const [title, setTitle] = useState('New Drop')
  const [stock, setStock] = useState(100)
  const [offsetStartMin, setOffsetStartMin] = useState(10)
  const [offsetWindowStartMin, setOffsetWindowStartMin] = useState(15)
  const [offsetWindowEndMin, setOffsetWindowEndMin] = useState(45)

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

  async function createDrop(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const now = new Date()
      const payload = {
        title,
        description: 'Created from Admin UI',
        starts_at: new Date(now.getTime() + offsetStartMin * 60000).toISOString(),
        claim_window_start: new Date(now.getTime() + offsetWindowStartMin * 60000).toISOString(),
        claim_window_end: new Date(now.getTime() + offsetWindowEndMin * 60000).toISOString(),
        stock,
        is_active: true,
      }
      await apiPost('/admin/drops', payload, headersToken)
      setInfo('Drop created')
      setTitle('New Drop')
      setStock(100)
      await loadDrops()
    } catch (e: any) {
      setError(e.message || 'Create failed')
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

  useEffect(() => {
    if (token && role === 'admin') {
      loadDrops()
    }
  }, [token, role])

  const activeDrops = drops.filter(d => d.is_active)
  const inactiveDrops = drops.filter(d => !d.is_active)

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <button onClick={() => navigate('/')} className="btn btn-secondary">Back to Home</button>
      </header>

      {info && <div className="mb-2 text-emerald-300 text-sm">{info}</div>}
      {error && <div className="mb-2 text-red-400 text-sm">{error}</div>}

      <section className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Create Drop</h2>
        <form onSubmit={createDrop} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Stock</span>
            <input className="input" type="number" value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} min={0} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1">
              <span className="text-xs text-slate-300">Start +min</span>
              <input className="input" type="number" value={offsetStartMin} onChange={(e) => setOffsetStartMin(parseInt(e.target.value || '0'))} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-slate-300">Claim Start +min</span>
              <input className="input" type="number" value={offsetWindowStartMin} onChange={(e) => setOffsetWindowStartMin(parseInt(e.target.value || '0'))} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-slate-300">Claim End +min</span>
              <input className="input" type="number" value={offsetWindowEndMin} onChange={(e) => setOffsetWindowEndMin(parseInt(e.target.value || '0'))} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">Create Drop</button>
        </form>
      </section>

      <section className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Active Drops ({activeDrops.length})</h2>
          <button onClick={loadDrops} className="btn btn-secondary" disabled={loading}>Refresh</button>
        </div>
        {error && <div className="mb-2 text-red-400 text-sm">{error}</div>}
        {loading ? (
          <div className="text-slate-300">Loading...</div>
        ) : activeDrops.length === 0 ? (
          <div className="text-slate-400">No active drops</div>
        ) : (
          <ul className="grid gap-3">
            {activeDrops.map(d => (
              <li key={d.id} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-slate-400 text-sm">Stock: {d.stock} | ID: {d.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => setEditing(d)}>Edit</button>
                    <button className="btn btn-secondary" onClick={() => deleteDrop(d.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Inactive Drops ({inactiveDrops.length})</h2>
        {inactiveDrops.length === 0 ? (
          <div className="text-slate-400">No inactive drops</div>
        ) : (
          <ul className="grid gap-3">
            {inactiveDrops.map(d => (
              <li key={d.id} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-slate-400 text-sm">Stock: {d.stock} | ID: {d.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => updateDrop(d.id, { is_active: true })}>Activate</button>
                    <button className="btn btn-primary" onClick={() => setEditing(d)}>Edit</button>
                    <button className="btn btn-secondary" onClick={() => deleteDrop(d.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Drop</h3>
            <EditForm
              drop={editing}
              onSave={(updates) => updateDrop(editing.id, updates)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EditForm({ drop, onSave, onCancel }: { drop: Drop; onSave: (updates: Partial<Drop>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(drop.title)
  const [stock, setStock] = useState(drop.stock)
  const [isActive, setIsActive] = useState(drop.is_active)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ title, stock, is_active: isActive })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-xs text-slate-300">Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-slate-300">Stock</span>
        <input className="input" type="number" value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} min={0} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-xs text-slate-300">Active</span>
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit">Save</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

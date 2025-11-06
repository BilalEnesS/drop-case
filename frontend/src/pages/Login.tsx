import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../api/client'

type TokenOut = { access_token: string; token_type: string }

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('Passw0rd!')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiPost<TokenOut>('/auth/login', { email, password })
      setToken(data.access_token)
      localStorage.setItem('access_token', data.access_token)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiPost('/auth/signup', { email, password })
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold mb-1">Welcome back</h1>
        <p className="text-sm text-slate-400 mb-6">Sign in to your account</p>
        <form onSubmit={handleLogin} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Email</span>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Password</span>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="text-red-400 text-sm">{error}</div>}
          {token && (
            <div className="text-emerald-400 text-sm">Logged in. Token saved.</div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Login'}
            </button>
            <button className="btn btn-secondary w-full" onClick={handleSignup} disabled={loading} type="button">
              {loading ? 'Loading...' : 'Signup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}



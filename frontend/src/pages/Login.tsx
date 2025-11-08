import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'

type TokenOut = { access_token: string; token_type: string; role?: string }

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiPost<TokenOut>('/auth/login', { email, password })
      localStorage.setItem('access_token', data.access_token)
      if (data.role === 'admin') {
        localStorage.setItem('role', 'admin')
        navigate('/admin', { replace: true })
      } else {
        localStorage.setItem('role', 'user')
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-3">DropSpot</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Join exclusive drops and limited stock releases
            </p>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Welcome Back</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Log in to your account to continue
            </p>
            
            <form onSubmit={handleLogin} className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Email</span>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Password</span>
                <input
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </label>

              {error && (
                <div className="text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {error}
                </div>
              )}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}



import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'

export function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      await apiPost('/auth/signup', { email, password })
      setSuccess(true)
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
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
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Create Account</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Sign up to join waitlists and claim exclusive drops
            </p>
            
            <form onSubmit={handleSignup} className="grid gap-4">
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
                  minLength={8}
                />
              </label>

              {error && (
                <div className="text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  Account created! Redirecting to login...
                </div>
              )}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}


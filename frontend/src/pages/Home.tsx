import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">DropSpot</h1>
        <button onClick={logout} className="btn btn-secondary">Logout</button>
      </header>

      <section className="card p-6">
        <h2 className="text-xl font-medium mb-2">Welcome</h2>
        <p className="text-slate-300">You are logged in. Upcoming work: drops list and join/leave actions.</p>
      </section>
    </div>
  )
}



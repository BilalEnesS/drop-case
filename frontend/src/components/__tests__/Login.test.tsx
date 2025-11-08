import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Login } from '../../pages/Login'

// Mock the API client
vi.mock('../../api/client', () => ({
  apiPost: vi.fn()
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders login form with email and password fields', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('displays error message on login failure', async () => {
    const { apiPost } = await import('../../api/client')
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('Invalid credentials'))

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const passwordInput = screen.getByPlaceholderText(/••••••••/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('redirects to home page on successful login for regular user', async () => {
    const { apiPost } = await import('../../api/client')
    vi.mocked(apiPost).mockResolvedValueOnce({
      access_token: 'test-token',
      token_type: 'bearer',
      role: 'user'
    })

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const passwordInput = screen.getByPlaceholderText(/••••••••/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('test-token')
      expect(localStorage.getItem('role')).toBe('user')
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('redirects to admin page on successful login for admin user', async () => {
    const { apiPost } = await import('../../api/client')
    vi.mocked(apiPost).mockResolvedValueOnce({
      access_token: 'admin-token',
      token_type: 'bearer',
      role: 'admin'
    })

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const passwordInput = screen.getByPlaceholderText(/••••••••/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    await userEvent.type(emailInput, 'admin@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('admin-token')
      expect(localStorage.getItem('role')).toBe('admin')
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true })
    })
  })

  it('shows link to signup page', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const signupLink = screen.getByRole('link', { name: /sign up/i })
    expect(signupLink).toBeInTheDocument()
    expect(signupLink).toHaveAttribute('href', '/signup')
  })
})


import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Home } from '../Home'

// Mock the API client
const mockApiGet = vi.fn()
const mockApiPost = vi.fn()

vi.mock('../../api/client', () => ({
  apiGet: (...args: any[]) => mockApiGet(...args),
  apiPost: (...args: any[]) => mockApiPost(...args)
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

// Mock ThemeToggle
vi.mock('../../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>
}))

const mockDrops = [
  {
    id: 1,
    title: 'Test Drop 1',
    description: 'Test Description',
    starts_at: '2024-01-01T00:00:00Z',
    claim_window_start: '2024-01-01T00:00:00Z',
    claim_window_end: '2024-12-31T23:59:59Z',
    stock: 10,
    is_active: true,
    joined: false,
    claimed: false
  },
  {
    id: 2,
    title: 'Test Drop 2',
    description: 'Test Description 2',
    starts_at: '2024-01-02T00:00:00Z',
    claim_window_start: '2024-01-02T00:00:00Z',
    claim_window_end: '2024-12-31T23:59:59Z',
    stock: 5,
    is_active: true,
    joined: true,
    claimed: false
  }
]

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('access_token', 'test-token')
    // Mock both /drops and /drops/claimed calls
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/drops/claimed') {
        return Promise.resolve([])
      }
      return Promise.resolve(mockDrops)
    })
  })

  it('redirects to login if no token', () => {
    localStorage.removeItem('access_token')
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('renders drops list on load', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/drops', 'test-token')
    })

    await waitFor(() => {
      expect(screen.getByText('Test Drop 1')).toBeInTheDocument()
      expect(screen.getByText('Test Drop 2')).toBeInTheDocument()
    })
  })

  it('displays join button for drops not joined', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Drop 1')).toBeInTheDocument()
    })

    // Wait for join button to appear (for drop 1 which is not joined)
    const joinButton = await screen.findByRole('button', { name: /join waitlist/i })
    expect(joinButton).toBeInTheDocument()
  })

  it('calls join API when join button is clicked', async () => {
    mockApiPost.mockResolvedValue({})
    let callCount = 0
    // Track API calls: first 2 calls (initial load), then after join
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/drops/claimed') {
        return Promise.resolve([])
      }
      // Initial load: return mockDrops with drop 1 not joined
      if (callCount === 0) {
        callCount++
        return Promise.resolve(mockDrops)
      }
      // After join: return updated drops with drop 1 joined
      callCount++
      return Promise.resolve([{ ...mockDrops[0], joined: true }, mockDrops[1]])
    })

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    // Wait for drops to load
    await waitFor(() => {
      expect(screen.getByText('Test Drop 1')).toBeInTheDocument()
    })

    // Wait for join button to appear
    const joinButton = await screen.findByRole('button', { name: /join waitlist/i })
    await userEvent.click(joinButton)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/drops/1/join', {}, 'test-token')
    }, { timeout: 3000 })
  })

  it('calls leave API when leave button is clicked', async () => {
    mockApiPost.mockResolvedValue({})
    let dropsCallCount = 0
    // Track /drops API calls separately
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/drops/claimed') {
        return Promise.resolve([])
      }
      // Initial load: return mockDrops with drop 2 joined
      if (dropsCallCount === 0) {
        dropsCallCount++
        return Promise.resolve(mockDrops) // drop 2 is joined: true
      }
      // After leave, loadDrops is called again
      dropsCallCount++
      return Promise.resolve([mockDrops[0], { ...mockDrops[1], joined: false }])
    })

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    // Wait for drop 2 to appear
    await waitFor(() => {
      expect(screen.getByText('Test Drop 2')).toBeInTheDocument()
    })

    // Wait for leave button to appear (drop 2 is joined)
    const leaveButton = await screen.findByRole('button', { name: /leave waitlist/i })
    await userEvent.click(leaveButton)

    // Wait for API call
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/drops/2/leave', {}, 'test-token')
    }, { timeout: 3000 })
  })

  it('displays logout button', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    await waitFor(() => {
      const logoutButton = screen.getByText('Logout')
      expect(logoutButton).toBeInTheDocument()
    })
  })

  it('logs out user when logout button is clicked', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    const logoutButton = screen.getByText('Logout')
    await userEvent.click(logoutButton)

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('displays loading state', () => {
    // Mock to never resolve
    mockApiGet.mockImplementation(() => new Promise(() => {}))

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays error message on API error', async () => {
    // First call to /drops fails
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/drops') {
        return Promise.reject(new Error('Failed to load drops'))
      }
      return Promise.resolve([])
    })

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/failed to load drops/i)).toBeInTheDocument()
    })
  })
})


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Onboarding } from '@/app/components/Onboarding'

// Mock dependencies
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    login: vi.fn()
  }))
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('Onboarding Component', () => {
  const mockOnComplete = vi.fn()
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup Privy mock
    const { usePrivy } = vi.mocked(await import('@privy-io/react-auth'))
    usePrivy.mockReturnValue({
      login: mockLogin,
      authenticated: false,
      ready: true,
      user: null,
      logout: vi.fn(),
      linkEmail: vi.fn(),
      linkWallet: vi.fn(),
      unlinkEmail: vi.fn(),
      linkPhone: vi.fn(),
      unlinkPhone: vi.fn(),
      linkGoogle: vi.fn(),
      unlinkGoogle: vi.fn(),
      linkTwitter: vi.fn(),
      unlinkTwitter: vi.fn(),
      linkDiscord: vi.fn(),
      unlinkDiscord: vi.fn(),
      linkGithub: vi.fn(),
      unlinkGithub: vi.fn(),
      linkApple: vi.fn(),
      unlinkApple: vi.fn(),
      linkLinkedIn: vi.fn(),
      unlinkLinkedIn: vi.fn(),
      linkTiktok: vi.fn(),
      unlinkTiktok: vi.fn(),
      linkFarcaster: vi.fn(),
      unlinkFarcaster: vi.fn(),
      linkPasskey: vi.fn(),
      unlinkPasskey: vi.fn(),
      setWalletPassword: vi.fn(),
      exportWallet: vi.fn(),
      createWallet: vi.fn(),
      connectWallet: vi.fn(),
      signMessage: vi.fn(),
      signTypedData: vi.fn(),
      sendTransaction: vi.fn(),
      getAccessToken: vi.fn()
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial render', () => {
    it('should render welcome screen initially', () => {
      render(<Onboarding onComplete={mockOnComplete} />)
      
      expect(screen.getByText(/Welcome to Canary/i)).toBeInTheDocument()
      expect(screen.getByText(/Your digital deadman switch/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument()
    })

    it('should display logo', () => {
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const logo = screen.getByAltText('Canary')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/canary.png')
    })
  })

  describe('Navigation', () => {
    it('should navigate through onboarding steps', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Step 1: Welcome
      expect(screen.getByText(/Welcome to Canary/i)).toBeInTheDocument()
      
      // Click Get Started
      await user.click(screen.getByRole('button', { name: /Get Started/i }))
      
      // Step 2: How it works
      await waitFor(() => {
        expect(screen.getByText(/How It Works/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/Upload Your Files/i)).toBeInTheDocument()
      
      // Click Next
      await user.click(screen.getByRole('button', { name: /Next/i }))
      
      // Step 3: Security
      await waitFor(() => {
        expect(screen.getByText(/Your Security Matters/i)).toBeInTheDocument()
      })
      
      // Click Next
      await user.click(screen.getByRole('button', { name: /Next/i }))
      
      // Step 4: Sign in
      await waitFor(() => {
        expect(screen.getByText(/Sign In to Get Started/i)).toBeInTheDocument()
      })
    })

    it('should allow going back to previous steps', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Navigate to step 2
      await user.click(screen.getByRole('button', { name: /Get Started/i }))
      await waitFor(() => {
        expect(screen.getByText(/How It Works/i)).toBeInTheDocument()
      })
      
      // Click Back
      await user.click(screen.getByRole('button', { name: /Back/i }))
      
      // Should be back at step 1
      await waitFor(() => {
        expect(screen.getByText(/Welcome to Canary/i)).toBeInTheDocument()
      })
    })
  })

  describe('Progress indicator', () => {
    it('should show progress dots', () => {
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      expect(progressDots).toHaveLength(4)
    })

    it('should update active progress dot', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      
      // Initially first dot should be active
      expect(progressDots[0]).toHaveClass('bg-green-500')
      expect(progressDots[1]).toHaveClass('bg-gray-700')
      
      // Navigate to step 2
      await user.click(screen.getByRole('button', { name: /Get Started/i }))
      
      await waitFor(() => {
        expect(progressDots[1]).toHaveClass('bg-green-500')
        expect(progressDots[0]).toHaveClass('bg-gray-700')
      })
    })

    it('should allow direct navigation via progress dots', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      
      // Click on step 3 dot
      await user.click(progressDots[2])
      
      // Should navigate to step 3
      await waitFor(() => {
        expect(screen.getByText(/Your Security Matters/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sign in flow', () => {
    it('should call login when sign in with email is clicked', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Navigate to sign in step
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      await user.click(progressDots[3])
      
      await waitFor(() => {
        expect(screen.getByText(/Sign In to Get Started/i)).toBeInTheDocument()
      })
      
      // Click sign in button
      await user.click(screen.getByRole('button', { name: /Sign in with Email/i }))
      
      expect(mockLogin).toHaveBeenCalledOnce()
    })

    it('should handle login success', async () => {
      const user = userEvent.setup()
      const { usePrivy } = vi.mocked(await import('@privy-io/react-auth'))
      
      // Mock successful login
      mockLogin.mockImplementationOnce(async () => {
        // Simulate authenticated state after login
        usePrivy.mockReturnValueOnce({
          ...usePrivy(),
          authenticated: true,
          user: { id: 'user123' }
        } as any)
      })
      
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Navigate to sign in
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      await user.click(progressDots[3])
      
      // Sign in
      await user.click(screen.getByRole('button', { name: /Sign in with Email/i }))
      
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledOnce()
      })
    })

    it('should handle login error', async () => {
      const user = userEvent.setup()
      const toast = (await import('react-hot-toast')).default
      
      mockLogin.mockRejectedValueOnce(new Error('Login failed'))
      
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Navigate to sign in
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      await user.click(progressDots[3])
      
      // Try to sign in
      await user.click(screen.getByRole('button', { name: /Sign in with Email/i }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Login failed. Please try again.')
      })
    })

    it('should show loading state during login', async () => {
      const user = userEvent.setup()
      
      // Make login hang to test loading state
      mockLogin.mockImplementationOnce(() => new Promise(() => {}))
      
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Navigate to sign in
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      await user.click(progressDots[3])
      
      // Click sign in
      await user.click(screen.getByRole('button', { name: /Sign in with Email/i }))
      
      // Should show loading state
      expect(screen.getByRole('button', { name: /Signing in.../i })).toBeDisabled()
    })
  })

  describe('Step content', () => {
    it('should display correct content for How It Works step', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      await user.click(screen.getByRole('button', { name: /Get Started/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/Upload Your Files/i)).toBeInTheDocument()
        expect(screen.getByText(/Set Your Conditions/i)).toBeInTheDocument()
        expect(screen.getByText(/Stay Safe/i)).toBeInTheDocument()
      })
    })

    it('should display correct content for Security step', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const progressDots = screen.getAllByRole('button', { name: /Go to step/i })
      await user.click(progressDots[2])
      
      await waitFor(() => {
        expect(screen.getByText(/End-to-End Encryption/i)).toBeInTheDocument()
        expect(screen.getByText(/Decentralized Storage/i)).toBeInTheDocument()
        expect(screen.getByText(/You Control Everything/i)).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard navigation', () => {
    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Tab to Get Started button and press Enter
      await user.tab()
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/How It Works/i)).toBeInTheDocument()
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle rapid clicking', async () => {
      const user = userEvent.setup()
      render(<Onboarding onComplete={mockOnComplete} />)
      
      const getStartedButton = screen.getByRole('button', { name: /Get Started/i })
      
      // Click multiple times rapidly
      await user.click(getStartedButton)
      await user.click(getStartedButton)
      await user.click(getStartedButton)
      
      // Should only advance one step
      await waitFor(() => {
        expect(screen.getByText(/How It Works/i)).toBeInTheDocument()
      })
    })

    it('should not call onComplete multiple times', async () => {
      const user = userEvent.setup()
      const { usePrivy } = vi.mocked(await import('@privy-io/react-auth'))
      
      // Start with authenticated state
      usePrivy.mockReturnValue({
        ...usePrivy(),
        authenticated: true,
        user: { id: 'user123' }
      } as any)
      
      render(<Onboarding onComplete={mockOnComplete} />)
      
      // Wait a bit to ensure effect runs
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledOnce()
      })
      
      // Should not be called again
      expect(mockOnComplete).toHaveBeenCalledTimes(1)
    })
  })
})
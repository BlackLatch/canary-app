import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from '@/app/page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import toast from 'react-hot-toast'

// Mock dependencies
vi.mock('wagmi', () => ({
  useConnect: vi.fn(() => ({
    connectors: [],
    connect: vi.fn(),
    isPending: false
  })),
  useAccount: vi.fn(() => ({
    address: undefined,
    isConnected: false,
    chainId: undefined
  })),
  useDisconnect: vi.fn(() => ({
    disconnect: vi.fn()
  })),
  WagmiProvider: vi.fn(({ children }) => children)
}))

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    ready: true,
    authenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    user: null
  })),
  useWallets: vi.fn(() => ({
    wallets: []
  })),
  useConnectWallet: vi.fn(() => ({
    connectWallet: vi.fn()
  }))
}))

vi.mock('@privy-io/wagmi', () => ({
  useSetActiveWallet: vi.fn(() => ({
    setActiveWallet: vi.fn()
  }))
}))

vi.mock('@/app/lib/taco', () => ({
  initializeTaco: vi.fn().mockResolvedValue(true),
  encryptFileWithDossier: vi.fn(),
  commitEncryptedFileToPinata: vi.fn()
}))

vi.mock('@/app/lib/contract', () => ({
  createDossier: vi.fn(),
  checkIn: vi.fn(),
  getUserDossiers: vi.fn(),
  getDossierDetails: vi.fn(),
  getNextDossierId: vi.fn().mockResolvedValue(BigInt(1))
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}))

// Helper function to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('Main Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial state', () => {
    it('should show onboarding for new users', () => {
      renderWithProviders(<Page />)
      
      expect(screen.getByText(/Welcome to Canary/i)).toBeInTheDocument()
      expect(screen.queryByText(/Setup Your Deadman Switch/i)).not.toBeInTheDocument()
    })

    it('should skip onboarding if user completed it before', () => {
      localStorage.setItem('canary-onboarding-complete', 'true')
      
      renderWithProviders(<Page />)
      
      expect(screen.queryByText(/Welcome to Canary/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Setup Your Deadman Switch/i)).toBeInTheDocument()
    })
  })

  describe('Authentication flow', () => {
    it('should show connect wallet button when not authenticated', () => {
      localStorage.setItem('canary-onboarding-complete', 'true')
      
      renderWithProviders(<Page />)
      
      expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument()
    })

    it('should handle Privy login', async () => {
      const user = userEvent.setup()
      const mockLogin = vi.fn()
      const { usePrivy } = vi.mocked(await import('@privy-io/react-auth'))
      usePrivy.mockReturnValue({
        ready: true,
        authenticated: false,
        login: mockLogin,
        logout: vi.fn(),
        user: null
      } as any)
      
      localStorage.setItem('canary-onboarding-complete', 'true')
      renderWithProviders(<Page />)
      
      await user.click(screen.getByRole('button', { name: /Connect Wallet/i }))
      
      expect(mockLogin).toHaveBeenCalledOnce()
    })

    it('should show user info when authenticated', () => {
      const { usePrivy } = vi.mocked(import('@privy-io/react-auth'))
      const { useAccount } = vi.mocked(import('wagmi'))
      
      usePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        user: { id: 'user123', email: { address: 'user@example.com' } }
      } as any)
      
      useAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chainId: 80002
      } as any)
      
      localStorage.setItem('canary-onboarding-complete', 'true')
      renderWithProviders(<Page />)
      
      expect(screen.getByText(/0x1234...7890/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument()
    })
  })

  describe('File encryption flow', () => {
    const setupAuthenticatedState = () => {
      const { usePrivy } = vi.mocked(import('@privy-io/react-auth'))
      const { useAccount } = vi.mocked(import('wagmi'))
      
      usePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        user: { id: 'user123' }
      } as any)
      
      useAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chainId: 80002
      } as any)
      
      localStorage.setItem('canary-onboarding-complete', 'true')
    }

    it('should handle file upload', async () => {
      const user = userEvent.setup()
      setupAuthenticatedState()
      
      renderWithProviders(<Page />)
      
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const fileInput = screen.getByLabelText(/Choose File/i)
      
      await user.upload(fileInput, file)
      
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })

    it('should handle condition selection', async () => {
      const user = userEvent.setup()
      setupAuthenticatedState()
      
      renderWithProviders(<Page />)
      
      // Select condition type
      const conditionSelect = screen.getByLabelText(/Condition Type/i)
      await user.selectOptions(conditionSelect, 'no_activity')
      
      // Set duration
      const durationInput = screen.getByLabelText(/Check-in Interval/i)
      await user.clear(durationInput)
      await user.type(durationInput, '7')
      
      expect(conditionSelect).toHaveValue('no_activity')
      expect(durationInput).toHaveValue('7')
    })

    it('should handle keyword input', async () => {
      const user = userEvent.setup()
      setupAuthenticatedState()
      
      renderWithProviders(<Page />)
      
      const keywordInput = screen.getByLabelText(/Secret Keyword/i)
      await user.type(keywordInput, 'mysecretword')
      
      expect(keywordInput).toHaveValue('mysecretword')
    })

    it('should handle full encryption flow', async () => {
      const user = userEvent.setup()
      setupAuthenticatedState()
      
      const { createDossier } = vi.mocked(await import('@/app/lib/contract'))
      const { encryptFileWithDossier, commitEncryptedFileToPinata } = vi.mocked(await import('@/app/lib/taco'))
      
      createDossier.mockResolvedValueOnce(BigInt(123))
      encryptFileWithDossier.mockResolvedValueOnce({
        messageKit: { data: 'encrypted' },
        encryptedData: new Uint8Array([1, 2, 3]),
        originalFileName: 'test.txt',
        condition: { type: 'no_activity', duration: '7 days', dossierId: BigInt(123), userAddress: '0x123' },
        description: 'Test file',
        capsuleUri: 'taco://test'
      })
      commitEncryptedFileToPinata.mockResolvedValueOnce({
        commitResult: {
          encryptionResult: {} as any,
          pinataCid: 'QmTest123',
          payloadUri: 'ipfs://QmTest123',
          storageType: 'pinata'
        },
        traceJson: {
          payload_uri: 'ipfs://QmTest123',
          taco_capsule_uri: 'taco://test',
          condition: '7 days',
          description: 'Test file',
          storage_type: 'pinata',
          created_at: new Date().toISOString(),
          dossier_id: '123',
          user_address: '0x123',
          contract_address: '0xContract'
        }
      })
      
      renderWithProviders(<Page />)
      
      // Upload file
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await user.upload(screen.getByLabelText(/Choose File/i), file)
      
      // Set condition
      await user.selectOptions(screen.getByLabelText(/Condition Type/i), 'no_activity')
      await user.clear(screen.getByLabelText(/Check-in Interval/i))
      await user.type(screen.getByLabelText(/Check-in Interval/i), '7')
      
      // Set keyword
      await user.type(screen.getByLabelText(/Secret Keyword/i), 'mysecret')
      
      // Set name
      await user.type(screen.getByLabelText(/File Name/i), 'Test Dossier')
      
      // Encrypt
      await user.click(screen.getByRole('button', { name: /Encrypt & Upload/i }))
      
      await waitFor(() => {
        expect(createDossier).toHaveBeenCalledWith('mysecret', 7 * 24 * 60 * 60)
        expect(encryptFileWithDossier).toHaveBeenCalled()
        expect(commitEncryptedFileToPinata).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('File encrypted and uploaded successfully!')
      })
    })

    it('should handle encryption errors', async () => {
      const user = userEvent.setup()
      setupAuthenticatedState()
      
      const { createDossier } = vi.mocked(await import('@/app/lib/contract'))
      createDossier.mockRejectedValueOnce(new Error('Contract error'))
      
      renderWithProviders(<Page />)
      
      // Upload file
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      await user.upload(screen.getByLabelText(/Choose File/i), file)
      
      // Fill in required fields
      await user.selectOptions(screen.getByLabelText(/Condition Type/i), 'no_activity')
      await user.type(screen.getByLabelText(/Secret Keyword/i), 'secret')
      await user.type(screen.getByLabelText(/File Name/i), 'Test')
      
      // Try to encrypt
      await user.click(screen.getByRole('button', { name: /Encrypt & Upload/i }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to encrypt'))
      })
    })
  })

  describe('Dossier management', () => {
    const setupWithDossiers = () => {
      const { usePrivy } = vi.mocked(import('@privy-io/react-auth'))
      const { useAccount } = vi.mocked(import('wagmi'))
      const { getUserDossiers, getDossierDetails } = vi.mocked(import('@/app/lib/contract'))
      
      usePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        user: { id: 'user123' }
      } as any)
      
      useAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chainId: 80002
      } as any)
      
      getUserDossiers.mockResolvedValue([BigInt(1), BigInt(2)])
      getDossierDetails.mockImplementation(async (id) => ({
        owner: '0x1234567890123456789012345678901234567890',
        checkInInterval: BigInt(7 * 24 * 60 * 60),
        lastCheckIn: BigInt(Math.floor(Date.now() / 1000) - 3600),
        keyword: 'secret',
        active: true
      }))
      
      localStorage.setItem('canary-onboarding-complete', 'true')
    }

    it('should display user dossiers', async () => {
      setupWithDossiers()
      
      renderWithProviders(<Page />)
      
      await waitFor(() => {
        expect(screen.getByText(/Dossier #1/i)).toBeInTheDocument()
        expect(screen.getByText(/Dossier #2/i)).toBeInTheDocument()
      })
    })

    it('should handle check-in', async () => {
      const user = userEvent.setup()
      setupWithDossiers()
      
      const { checkIn } = vi.mocked(await import('@/app/lib/contract'))
      checkIn.mockResolvedValueOnce('0xTransactionHash')
      
      renderWithProviders(<Page />)
      
      await waitFor(() => {
        expect(screen.getByText(/Dossier #1/i)).toBeInTheDocument()
      })
      
      // Click check-in for first dossier
      const dossierCard = screen.getByText(/Dossier #1/i).closest('div')!
      const checkInButton = within(dossierCard).getByRole('button', { name: /Check In/i })
      
      await user.click(checkInButton)
      
      // Enter keyword in modal
      const keywordInput = screen.getByPlaceholderText(/Enter your secret keyword/i)
      await user.type(keywordInput, 'secret')
      
      // Submit check-in
      const submitButton = screen.getByRole('button', { name: /Submit Check-in/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(checkIn).toHaveBeenCalledWith(BigInt(1), 'secret')
        expect(toast.success).toHaveBeenCalledWith('Check-in successful!')
      })
    })

    it('should handle check-in errors', async () => {
      const user = userEvent.setup()
      setupWithDossiers()
      
      const { checkIn } = vi.mocked(await import('@/app/lib/contract'))
      checkIn.mockRejectedValueOnce(new Error('Incorrect keyword'))
      
      renderWithProviders(<Page />)
      
      await waitFor(() => {
        expect(screen.getByText(/Dossier #1/i)).toBeInTheDocument()
      })
      
      // Open check-in modal
      const dossierCard = screen.getByText(/Dossier #1/i).closest('div')!
      await user.click(within(dossierCard).getByRole('button', { name: /Check In/i }))
      
      // Try to check in with wrong keyword
      await user.type(screen.getByPlaceholderText(/Enter your secret keyword/i), 'wrong')
      await user.click(screen.getByRole('button', { name: /Submit Check-in/i }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Check-in failed'))
      })
    })
  })

  describe('Responsive behavior', () => {
    it('should show mobile-friendly layout on small screens', () => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }))
      })
      
      localStorage.setItem('canary-onboarding-complete', 'true')
      renderWithProviders(<Page />)
      
      // Check for mobile-specific classes or layouts
      const mainContainer = screen.getByRole('main')
      expect(mainContainer).toHaveClass('min-h-screen')
    })
  })

  describe('Error boundaries', () => {
    it('should handle initialization errors gracefully', async () => {
      const { initializeTaco } = vi.mocked(await import('@/app/lib/taco'))
      initializeTaco.mockRejectedValueOnce(new Error('TACo init failed'))
      
      localStorage.setItem('canary-onboarding-complete', 'true')
      renderWithProviders(<Page />)
      
      // Should still render the page
      expect(screen.getByText(/Setup Your Deadman Switch/i)).toBeInTheDocument()
    })
  })

  describe('Loading states', () => {
    it('should show loading state while fetching dossiers', async () => {
      const { usePrivy } = vi.mocked(import('@privy-io/react-auth'))
      const { useAccount } = vi.mocked(import('wagmi'))
      const { getUserDossiers } = vi.mocked(import('@/app/lib/contract'))
      
      usePrivy.mockReturnValue({
        ready: true,
        authenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        user: { id: 'user123' }
      } as any)
      
      useAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        chainId: 80002
      } as any)
      
      // Make getUserDossiers hang
      getUserDossiers.mockImplementationOnce(() => new Promise(() => {}))
      
      localStorage.setItem('canary-onboarding-complete', 'true')
      renderWithProviders(<Page />)
      
      expect(screen.getByText(/Loading dossiers.../i)).toBeInTheDocument()
    })
  })
})
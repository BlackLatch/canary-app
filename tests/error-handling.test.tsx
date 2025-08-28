import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import toast from 'react-hot-toast'
import { ContractService } from '../app/lib/contract'
import Home from '../app/page'

// Mock modules
vi.mock('react-hot-toast')
vi.mock('../app/lib/contract')
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ 
    address: '0x123',
    isConnected: true,
    chainId: 80002 
  })),
  useConnect: vi.fn(() => ({ 
    connectors: [],
    connect: vi.fn(),
    isPending: false 
  })),
  useDisconnect: vi.fn(() => ({ disconnect: vi.fn() }))
}))
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({ 
    ready: true,
    authenticated: true,
    user: { id: 'user123' },
    login: vi.fn(),
    logout: vi.fn()
  })),
  useWallets: vi.fn(() => ({ wallets: [] })),
  useConnectWallet: vi.fn(() => ({ connectWallet: vi.fn() }))
}))
vi.mock('@privy-io/wagmi', () => ({
  useSetActiveWallet: vi.fn(() => ({ setActiveWallet: vi.fn() }))
}))

describe('Transaction Error Handling', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('canary-onboarding-complete', 'true')
  })

  describe('User Rejected Transactions', () => {
    it('should show info toast when user rejects createDossier transaction', async () => {
      // Mock getUserDossierIds to return empty array
      vi.mocked(ContractService.getUserDossierIds).mockResolvedValue([])
      
      // Mock createDossier to throw user rejection error
      vi.mocked(ContractService.createDossier).mockRejectedValue(
        new Error('Transaction was rejected by user')
      )

      render(<Home />)

      // Upload a file
      const fileInput = screen.getByLabelText(/Upload Dossier/i)
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await user.upload(fileInput, file)

      // Set check-in interval
      const intervalInput = screen.getByPlaceholderText(/60/)
      await user.clear(intervalInput)
      await user.type(intervalInput, '120')

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Protected Dossier/i })
      await user.click(createButton)

      // Wait for the transaction to be rejected
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('Transaction cancelled')
      })

      // Should not show error toast
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('should show info toast when user rejects checkIn transaction', async () => {
      // Mock getUserDossierIds to return a dossier
      vi.mocked(ContractService.getUserDossierIds).mockResolvedValue([BigInt(0)])
      
      // Mock getDossier to return an active dossier
      vi.mocked(ContractService.getDossier).mockResolvedValue({
        id: BigInt(0),
        name: 'Test Dossier',
        isActive: true,
        checkInInterval: BigInt(3600),
        lastCheckIn: BigInt(Math.floor(Date.now() / 1000) - 1800),
        encryptedFileHashes: ['ipfs://test'],
        recipients: ['0x123']
      })

      // Mock checkInAll to throw user rejection error
      vi.mocked(ContractService.checkInAll).mockRejectedValue(
        new Error('Transaction was rejected by user')
      )

      render(<Home />)

      // Wait for dossiers to load
      await waitFor(() => {
        expect(screen.getByText(/1 active documents protected/i)).toBeInTheDocument()
      })

      // Click check-in button
      const checkInButton = screen.getByRole('button', { name: /Check In Now/i })
      await user.click(checkInButton)

      // Wait for the transaction to be rejected
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('Check-in cancelled')
      })

      // Should dismiss loading toast
      expect(toast.dismiss).toHaveBeenCalled()
      
      // Should not show error toast
      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe('Insufficient Funds Errors', () => {
    it('should show helpful error message for insufficient funds', async () => {
      // Mock getUserDossierIds to return empty array
      vi.mocked(ContractService.getUserDossierIds).mockResolvedValue([])
      
      // Mock createDossier to throw insufficient funds error
      vi.mocked(ContractService.createDossier).mockRejectedValue(
        new Error('Insufficient funds for transaction')
      )

      render(<Home />)

      // Upload a file
      const fileInput = screen.getByLabelText(/Upload Dossier/i)
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await user.upload(fileInput, file)

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Protected Dossier/i })
      await user.click(createButton)

      // Wait for the error
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Insufficient funds for transaction. Please add MATIC to your wallet.',
          expect.any(Object)
        )
      })
    })
  })

  describe('Network Errors', () => {
    it('should show network switch message for wrong network', async () => {
      // Mock getUserDossierIds to return empty array
      vi.mocked(ContractService.getUserDossierIds).mockResolvedValue([])
      
      // Mock createDossier to throw network error
      vi.mocked(ContractService.createDossier).mockRejectedValue(
        new Error('Wrong network. Please switch to Polygon Amoy')
      )

      render(<Home />)

      // Upload a file
      const fileInput = screen.getByLabelText(/Upload Dossier/i)
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      await user.upload(fileInput, file)

      // Click create button
      const createButton = screen.getByRole('button', { name: /Create Protected Dossier/i })
      await user.click(createButton)

      // Wait for the error
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Please switch to Polygon Amoy network in your wallet.',
          expect.any(Object)
        )
      })
    })
  })

  describe('Activity Log', () => {
    it('should log user cancellations differently than errors', async () => {
      // Mock dossiers
      vi.mocked(ContractService.getUserDossierIds).mockResolvedValue([BigInt(0)])
      vi.mocked(ContractService.getDossier).mockResolvedValue({
        id: BigInt(0),
        name: 'Test Dossier',
        isActive: true,
        checkInInterval: BigInt(3600),
        lastCheckIn: BigInt(Math.floor(Date.now() / 1000) - 1800),
        encryptedFileHashes: ['ipfs://test'],
        recipients: ['0x123']
      })

      // Mock checkInAll to throw user rejection error
      vi.mocked(ContractService.checkInAll).mockRejectedValue(
        new Error('Transaction was rejected by user')
      )

      render(<Home />)

      // Wait for dossiers to load
      await waitFor(() => {
        expect(screen.getByText(/1 active documents protected/i)).toBeInTheDocument()
      })

      // Show activity log
      const activityButton = screen.getByRole('button', { name: /Activity/i })
      await user.click(activityButton)

      // Click check-in button
      const checkInButton = screen.getByRole('button', { name: /Check In Now/i })
      await user.click(checkInButton)

      // Wait for the activity log entry
      await waitFor(() => {
        expect(screen.getByText(/ℹ️ Check-in cancelled by user/)).toBeInTheDocument()
      })

      // Should not show as error
      expect(screen.queryByText(/❌ Check-in failed/)).not.toBeInTheDocument()
    })
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPrivyEthersProvider, walletClientToProvider } from '@/app/lib/ethers-adapter'
import { getEthereumProvider } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import type { WalletClient } from 'viem'

// Mock Privy
vi.mock('@privy-io/react-auth', () => ({
  getEthereumProvider: vi.fn()
}))

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: vi.fn().mockImplementation((provider, network) => ({
        provider,
        network,
        getSigner: vi.fn().mockReturnValue({
          address: '0x1234567890123456789012345678901234567890',
          getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
        })
      }))
    }
  }
}))

describe('Ethers Adapter', () => {
  const mockPrivyProvider = {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    isPrivy: true
  }

  const mockWindowEthereum = {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    isMetaMask: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.ethereum
    (global.window as any).ethereum = mockWindowEthereum
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPrivyEthersProvider', () => {
    it('should return Privy provider when available', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(mockPrivyProvider as any)

      const result = await getPrivyEthersProvider()

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(mockPrivyProvider)
      expect(getEthereumProvider).toHaveBeenCalledOnce()
    })

    it('should fallback to window.ethereum when Privy not available', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(null)

      const result = await getPrivyEthersProvider()

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(mockWindowEthereum)
    })

    it('should throw error when no provider is available', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(null)
      delete (global.window as any).ethereum

      await expect(getPrivyEthersProvider()).rejects.toThrow(
        'No wallet provider found. Please connect your wallet.'
      )
    })

    it('should handle getEthereumProvider rejection', async () => {
      vi.mocked(getEthereumProvider).mockRejectedValueOnce(new Error('Privy error'))

      // Should fallback to window.ethereum
      const result = await getPrivyEthersProvider()

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(mockWindowEthereum)
    })

    it('should work in non-browser environment', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(null)
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      await expect(getPrivyEthersProvider()).rejects.toThrow(
        'No wallet provider found. Please connect your wallet.'
      )

      global.window = originalWindow
    })
  })

  describe('walletClientToProvider', () => {
    const mockChain = {
      id: 80002,
      name: 'Polygon Amoy',
      contracts: {
        ensRegistry: {
          address: '0x123456'
        }
      }
    }

    it('should convert wallet client with standard transport', () => {
      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: {
          type: 'custom',
          request: vi.fn()
        } as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        mockWalletClient.transport,
        expect.objectContaining({
          chainId: 80002,
          name: 'Polygon Amoy',
          ensAddress: '0x123456'
        })
      )
    })

    it('should handle transport with provider property', () => {
      const mockProvider = { request: vi.fn() }
      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: {
          provider: mockProvider
        } as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        mockProvider,
        expect.any(Object)
      )
    })

    it('should handle transport with _provider property', () => {
      const mockProvider = { request: vi.fn() }
      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: {
          _provider: mockProvider
        } as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        mockProvider,
        expect.any(Object)
      )
    })

    it('should handle transport with request property', () => {
      const mockRequest = vi.fn()
      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: {
          request: mockRequest
        } as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        mockRequest,
        expect.any(Object)
      )
    })

    it('should throw error when chain is missing', () => {
      const mockWalletClient: Partial<WalletClient> = {
        transport: { request: vi.fn() } as any
      }

      expect(() => walletClientToProvider(mockWalletClient as WalletClient))
        .toThrow('WalletClient must have a chain')
    })

    it('should handle chain without ENS registry', () => {
      const chainWithoutEns = {
        id: 1337,
        name: 'Local',
        contracts: {}
      }

      const mockWalletClient: Partial<WalletClient> = {
        chain: chainWithoutEns as any,
        transport: { request: vi.fn() } as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          chainId: 1337,
          name: 'Local',
          ensAddress: undefined
        })
      )
    })

    it('should handle null transport gracefully', () => {
      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: null as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        null,
        expect.any(Object)
      )
    })

    it('should handle complex transport object', () => {
      const complexTransport = {
        type: 'custom',
        key: 'complex',
        provider: {
          request: vi.fn()
        },
        _provider: {
          request: vi.fn()
        },
        request: vi.fn(),
        somethingElse: 'data'
      }

      const mockWalletClient: Partial<WalletClient> = {
        chain: mockChain as any,
        transport: complexTransport as any
      }

      const result = walletClientToProvider(mockWalletClient as WalletClient)

      expect(result).toBeDefined()
      // Should use provider property first
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(
        complexTransport.provider,
        expect.any(Object)
      )
    })
  })

  describe('Provider getSigner', () => {
    it('should get signer from Privy provider', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(mockPrivyProvider as any)

      const provider = await getPrivyEthersProvider()
      const signer = provider.getSigner()

      expect(signer).toBeDefined()
      expect(signer.address).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should get signer from wallet client provider', () => {
      const mockWalletClient: Partial<WalletClient> = {
        chain: {
          id: 1,
          name: 'Ethereum'
        } as any,
        transport: { request: vi.fn() } as any
      }

      const provider = walletClientToProvider(mockWalletClient as WalletClient)
      const signer = provider.getSigner()

      expect(signer).toBeDefined()
      expect(signer.getAddress).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined window in SSR', async () => {
      const originalWindow = global.window
      // @ts-ignore
      global.window = undefined
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(null)

      await expect(getPrivyEthersProvider()).rejects.toThrow(
        'No wallet provider found'
      )

      global.window = originalWindow
    })

    it('should handle window.ethereum being undefined', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValueOnce(null)
      // @ts-ignore
      global.window.ethereum = undefined

      await expect(getPrivyEthersProvider()).rejects.toThrow(
        'No wallet provider found'
      )
    })

    it('should handle multiple concurrent calls', async () => {
      vi.mocked(getEthereumProvider).mockResolvedValue(mockPrivyProvider as any)

      const promises = Array(5).fill(null).map(() => getPrivyEthersProvider())
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      expect(results.every(r => r !== null)).toBe(true)
      expect(getEthereumProvider).toHaveBeenCalledTimes(5)
    })
  })
})
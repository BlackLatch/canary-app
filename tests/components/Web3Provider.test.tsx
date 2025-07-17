import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Web3Provider } from '@/app/components/Web3Provider'
import { QueryClient } from '@tanstack/react-query'

// Mock dependencies
vi.mock('@privy-io/react-auth', () => ({
  PrivyProvider: vi.fn(({ children }) => <div data-testid="privy-provider">{children}</div>)
}))

vi.mock('@privy-io/wagmi', () => ({
  WagmiProvider: vi.fn(({ children }) => <div data-testid="wagmi-provider">{children}</div>)
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: vi.fn(({ children }) => <div data-testid="query-provider">{children}</div>)
}))

vi.mock('@/app/lib/web3', () => ({
  config: { testConfig: true }
}))

describe('Web3Provider Component', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  describe('Rendering', () => {
    it('should render all providers in correct order', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(
        <Web3Provider>
          <div>Test Child</div>
        </Web3Provider>
      )

      expect(screen.getByTestId('privy-provider')).toBeInTheDocument()
      expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-provider')).toBeInTheDocument()
      expect(screen.getByText('Test Child')).toBeInTheDocument()
    })

    it('should pass children through all providers', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(
        <Web3Provider>
          <button>Click me</button>
          <span>Some text</span>
        </Web3Provider>
      )

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
      expect(screen.getByText('Some text')).toBeInTheDocument()
    })
  })

  describe('PrivyProvider configuration', () => {
    it('should configure PrivyProvider with app ID from env', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'real-app-id-123'
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'real-app-id-123'
        }),
        expect.any(Object)
      )
    })

    it('should use fallback app ID when env var is not set', () => {
      delete process.env.NEXT_PUBLIC_PRIVY_APP_ID
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'clxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        }),
        expect.any(Object)
      )
    })

    it('should configure login methods correctly', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            loginMethods: ['email', 'wallet']
          })
        }),
        expect.any(Object)
      )
    })

    it('should configure appearance correctly', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            appearance: {
              theme: 'light',
              accentColor: '#676FFF',
              logo: '/canary.png'
            }
          })
        }),
        expect.any(Object)
      )
    })

    it('should configure embedded wallets correctly', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            embeddedWallets: {
              createOnLogin: 'users-without-wallets',
              requireUserPasswordOnCreate: false
            }
          })
        }),
        expect.any(Object)
      )
    })

    it('should configure Polygon Amoy as default chain', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { PrivyProvider } = vi.mocked(await import('@privy-io/react-auth'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(PrivyProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            defaultChain: expect.objectContaining({
              id: 80002,
              name: 'Polygon Amoy',
              network: 'polygon-amoy',
              nativeCurrency: {
                decimals: 18,
                name: 'MATIC',
                symbol: 'MATIC'
              }
            })
          })
        }),
        expect.any(Object)
      )
    })
  })

  describe('WagmiProvider configuration', () => {
    it('should pass config to WagmiProvider', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { WagmiProvider } = vi.mocked(await import('@privy-io/wagmi'))
      const { config } = vi.mocked(await import('@/app/lib/web3'))
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(WagmiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          config: config
        }),
        expect.any(Object)
      )
    })
  })

  describe('QueryClientProvider configuration', () => {
    it('should create a new QueryClient', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(QueryClient).toHaveBeenCalledOnce()
    })

    it('should pass QueryClient to provider', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      const { QueryClientProvider } = vi.mocked(await import('@tanstack/react-query'))
      const mockQueryClient = {}
      vi.mocked(QueryClient).mockReturnValueOnce(mockQueryClient as any)
      
      render(
        <Web3Provider>
          <div>Test</div>
        </Web3Provider>
      )

      expect(QueryClientProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          client: mockQueryClient
        }),
        expect.any(Object)
      )
    })
  })

  describe('Multiple instances', () => {
    it('should create separate QueryClient instances', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(
        <>
          <Web3Provider>
            <div>Instance 1</div>
          </Web3Provider>
          <Web3Provider>
            <div>Instance 2</div>
          </Web3Provider>
        </>
      )

      expect(QueryClient).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Instance 1')).toBeInTheDocument()
      expect(screen.getByText('Instance 2')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty children', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      const { container } = render(<Web3Provider>{null}</Web3Provider>)
      
      expect(container.querySelector('[data-testid="privy-provider"]')).toBeInTheDocument()
    })

    it('should handle fragment children', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(
        <Web3Provider>
          <>
            <div>Child 1</div>
            <div>Child 2</div>
          </>
        </Web3Provider>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })

    it('should handle string children', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      render(<Web3Provider>Just a string</Web3Provider>)
      
      expect(screen.getByText('Just a string')).toBeInTheDocument()
    })

    it('should handle React elements array', () => {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id'
      
      const elements = [
        <div key="1">Element 1</div>,
        <div key="2">Element 2</div>
      ]
      
      render(<Web3Provider>{elements}</Web3Provider>)
      
      expect(screen.getByText('Element 1')).toBeInTheDocument()
      expect(screen.getByText('Element 2')).toBeInTheDocument()
    })
  })
})
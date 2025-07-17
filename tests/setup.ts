import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.ethereum for Web3 tests
global.window = {
  ...global.window,
  ethereum: {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    isMetaMask: true,
  },
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock fetch for API tests
global.fetch = vi.fn()

// Mock crypto for browser crypto APIs
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
    subtle: {
      digest: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
  },
})

// Suppress console errors during tests unless explicitly testing error handling
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOMTestUtils.act is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
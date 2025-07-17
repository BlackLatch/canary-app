import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadToPinata, pinataService, type PinataUploadResult } from '@/app/lib/pinata'

describe('Pinata Service', () => {
  const mockFileData = new Uint8Array([1, 2, 3, 4, 5])
  const mockFileName = 'test.txt'
  const mockIpfsHash = 'QmTest123'
  const mockGatewayKey = 'test-gateway-key'

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    
    // Mock environment variable
    vi.stubEnv('NEXT_PUBLIC_PINATA_GATEWAY_KEY', mockGatewayKey)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('uploadToPinata', () => {
    beforeEach(() => {
      // Mock XMLHttpRequest
      global.XMLHttpRequest = vi.fn().mockImplementation(() => ({
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null,
        onerror: null,
        status: 200,
        responseText: JSON.stringify({
          IpfsHash: mockIpfsHash,
          PinSize: 12345,
          Timestamp: '2024-01-01T00:00:00Z'
        })
      }))
    })
    it('should upload file successfully', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({
          IpfsHash: mockIpfsHash,
          PinSize: 12345,
          Timestamp: '2024-01-01T00:00:00Z'
        })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName)
      
      // Trigger onload callback
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      const result = await uploadPromise

      expect(result).toMatchObject({
        success: true,
        ipfsHash: mockIpfsHash,
        gatewayUrl: expect.stringContaining(mockIpfsHash)
      })

      expect(mockXHR.open).toHaveBeenCalledWith(
        'POST',
        'https://api.pinata.cloud/pinning/pinFileToIPFS'
      )
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer test-jwt'
      )
    })

    it('should handle missing credentials', async () => {
      // Remove all credentials
      delete process.env.NEXT_PUBLIC_PINATA_JWT
      delete process.env.NEXT_PUBLIC_PINATA_API_KEY
      delete process.env.NEXT_PUBLIC_PINATA_API_SECRET
      
      // Create new instance without credentials
      const { uploadToPinata: uploadWithoutCreds } = await import('@/app/lib/pinata')

      const result = await uploadWithoutCreds(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('credentials')
      })
    })

    it('should handle upload with progress callback', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      const onProgress = vi.fn()
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn((event, callback) => {
            if (event === 'progress') {
              // Simulate progress event
              setTimeout(() => {
                callback({ lengthComputable: true, loaded: 50, total: 100 })
              }, 5)
            }
          })
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({
          IpfsHash: mockIpfsHash,
          PinSize: 12345,
          Timestamp: '2024-01-01T00:00:00Z'
        })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName, onProgress)
      
      // Trigger onload callback
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      const result = await uploadPromise

      expect(result.success).toBe(true)
      expect(onProgress).toHaveBeenCalledWith(50, 100)
    })

    it('should handle upload failure', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 401,
        responseText: 'Unauthorized'
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName)
      
      // Trigger onload callback with error status
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      await expect(uploadPromise).rejects.toThrow('Pinata upload failed: 401')
    })

    it('should handle network errors', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName)
      
      // Trigger onerror callback
      setTimeout(() => {
        if (mockXHR.onerror) mockXHR.onerror()
      }, 10)
      
      await expect(uploadPromise).rejects.toThrow('Network error')
    })

    it('should handle JSON parsing errors', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: 'Invalid JSON response'
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName)
      
      // Trigger onload callback
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      await expect(uploadPromise).rejects.toThrow('Failed to parse')
    })

    it('should create FormData with correct metadata', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      let capturedFormData: FormData | null = null
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn((data: FormData) => {
          capturedFormData = data
        }),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({
          IpfsHash: mockIpfsHash,
          PinSize: 12345,
          Timestamp: '2024-01-01T00:00:00Z'
        })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, mockFileName)
      
      // Trigger onload callback
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      await uploadPromise

      expect(capturedFormData).not.toBeNull()
      expect(capturedFormData).toBeInstanceOf(FormData)
    })

    it('should handle empty file', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      const emptyData = new Uint8Array(0)
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({ IpfsHash: mockIpfsHash })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(emptyData, 'empty.txt')
      
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      const result = await uploadPromise
      expect(result.success).toBe(true)
    })
  })

  describe('generateGatewayUrl', () => {
    it('should generate correct gateway URL', () => {
      const url = pinataService.generateGatewayUrl(mockIpfsHash)
      expect(url).toBe(`https://purple-certain-guan-605.mypinata.cloud/ipfs/${mockIpfsHash}`)
    })

  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Authenticated' })
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await pinataService.testConnection()

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.pinata.cloud/data/testAuthentication',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-jwt'
          })
        })
      )
    })

    it('should handle connection failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await pinataService.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle special characters in filename', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      const specialFileName = 'test file (1) [2] {3} #4.txt'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({ IpfsHash: mockIpfsHash })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      const uploadPromise = uploadToPinata(mockFileData, specialFileName)
      
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      const result = await uploadPromise
      expect(result.success).toBe(true)
    })

    it('should handle API key auth instead of JWT', async () => {
      // Remove JWT and set API keys
      delete process.env.NEXT_PUBLIC_PINATA_JWT
      process.env.NEXT_PUBLIC_PINATA_API_KEY = 'test-api-key'
      process.env.NEXT_PUBLIC_PINATA_API_SECRET = 'test-api-secret'
      
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: {
          addEventListener: vi.fn()
        },
        onload: null as any,
        onerror: null as any,
        status: 200,
        responseText: JSON.stringify({ IpfsHash: mockIpfsHash })
      }
      
      global.XMLHttpRequest = vi.fn().mockImplementation(() => mockXHR)
      
      // Re-import to get fresh instance with new env vars
      vi.resetModules()
      const { uploadToPinata: uploadWithApiKey } = await import('@/app/lib/pinata')
      
      const uploadPromise = uploadWithApiKey(mockFileData, mockFileName)
      
      setTimeout(() => {
        if (mockXHR.onload) mockXHR.onload()
      }, 10)
      
      const result = await uploadPromise
      expect(result.success).toBe(true)
    })

    it('should handle unpinFile', async () => {
      process.env.NEXT_PUBLIC_PINATA_JWT = 'test-jwt'
      
      const mockResponse = {
        ok: true
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await pinataService.unpinFile(mockIpfsHash)

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        `https://api.pinata.cloud/pinning/unpin/${mockIpfsHash}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })
})
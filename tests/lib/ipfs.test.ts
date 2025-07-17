import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadToIPFS, initializeIPFS, retrieveFromIPFS, type IPFSUploadResult } from '@/app/lib/ipfs'
import { create } from 'helia'
import { unixfs } from '@helia/unixfs'

// Mock Helia and unixfs
vi.mock('helia', async () => {
  const actual = await vi.importActual('helia')
  return {
    ...actual,
    create: vi.fn()
  }
})

vi.mock('@helia/unixfs', async () => {
  const actual = await vi.importActual('@helia/unixfs')
  return {
    ...actual,
    unixfs: vi.fn()
  }
})

describe('IPFS Service', () => {
  const mockHelia = {
    stop: vi.fn()
  }

  const mockFs = {
    addBytes: vi.fn(),
    cat: vi.fn().mockImplementation(function* () {
      yield new Uint8Array([1, 2, 3])
      yield new Uint8Array([4, 5, 6])
    })
  }

  const mockFileData = new Uint8Array([1, 2, 3, 4, 5])
  const mockFileName = 'test.txt'
  const mockCID = { toString: () => 'QmTest123' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(create).mockResolvedValue(mockHelia as any)
    vi.mocked(unixfs).mockReturnValue(mockFs as any)
    
    // Mock fetch for gateway tests
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initializeIPFS', () => {
    it('should initialize IPFS successfully', async () => {
      const result = await initializeIPFS()
      
      expect(result).toBe(true)
      expect(create).toHaveBeenCalledOnce()
      expect(unixfs).toHaveBeenCalledWith(mockHelia)
    })

    it('should return false on initialization failure', async () => {
      vi.mocked(create).mockRejectedValueOnce(new Error('Failed to create Helia'))
      
      const result = await initializeIPFS()
      
      expect(result).toBe(false)
    })

    it('should not reinitialize if already initialized', async () => {
      await initializeIPFS()
      vi.clearAllMocks()
      
      await initializeIPFS()
      
      expect(create).not.toHaveBeenCalled()
    })
  })

  describe('uploadToIPFS', () => {
    beforeEach(() => {
      mockFs.addBytes.mockResolvedValue(mockCID)
    })

    it('should upload file successfully', async () => {
      const result = await uploadToIPFS(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: true,
        cid: 'QmTest123',
        gatewayUrl: expect.stringContaining('QmTest123'),
        gatewayUsed: 'primary'
      })

      expect(mockFs.addBytes).toHaveBeenCalledWith(mockFileData)
    })

    it('should handle upload timeout', async () => {
      // Make addBytes hang
      mockFs.addBytes.mockImplementationOnce(() => new Promise(() => {}))
      
      // Use fake timers for this test
      vi.useFakeTimers()
      
      const uploadPromise = uploadToIPFS(mockFileData, mockFileName)
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(30000)
      
      const result = await uploadPromise
      
      expect(result).toMatchObject({
        success: false,
        error: 'IPFS upload timed out after 30 seconds'
      })
      
      vi.useRealTimers()
    })

    it('should handle upload errors', async () => {
      mockFs.addBytes.mockRejectedValueOnce(new Error('Network error'))
      
      const result = await uploadToIPFS(mockFileData, mockFileName)
      
      expect(result).toMatchObject({
        success: false,
        error: 'Failed to upload to IPFS: Network error'
      })
    })

    it('should handle initialization failure', async () => {
      vi.mocked(create).mockRejectedValueOnce(new Error('Init failed'))
      
      const result = await uploadToIPFS(mockFileData, mockFileName)
      
      expect(result).toMatchObject({
        success: false,
        error: 'Failed to initialize IPFS: Init failed'
      })
    })

    it('should stop Helia node after upload', async () => {
      await uploadToIPFS(mockFileData, mockFileName)
      
      expect(mockHelia.stop).toHaveBeenCalledOnce()
    })

    it('should stop Helia node even on error', async () => {
      mockFs.addBytes.mockRejectedValueOnce(new Error('Upload error'))
      
      await uploadToIPFS(mockFileData, mockFileName)
      
      expect(mockHelia.stop).toHaveBeenCalledOnce()
    })
  })

  describe('retrieveFromIPFS', () => {
    const mockCid = 'QmTest123'

    it('should retrieve from primary gateway successfully', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5))
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await retrieveFromIPFS(mockCid)

      expect(result).toMatchObject({
        success: true,
        data: expect.any(Uint8Array),
        gatewayUsed: 'primary'
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('ipfs.io/ipfs/QmTest123'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('should fallback to secondary gateway on primary failure', async () => {
      // Primary fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Primary gateway error'))
      
      // Secondary succeeds
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5))
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await retrieveFromIPFS(mockCid)

      expect(result).toMatchObject({
        success: true,
        data: expect.any(Uint8Array),
        gatewayUsed: 'secondary'
      })

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('dweb.link/ipfs/QmTest123'),
        expect.any(Object)
      )
    })

    it('should try local Helia node when both gateways fail', async () => {
      // Both gateways fail
      vi.mocked(fetch).mockRejectedValue(new Error('Gateway error'))

      const result = await retrieveFromIPFS(mockCid)

      expect(result).toMatchObject({
        success: true,
        data: new Uint8Array([1, 2, 3, 4, 5, 6]),
        source: 'local'
      })

      expect(mockFs.cat).toHaveBeenCalledWith(expect.objectContaining({
        toString: expect.any(Function)
      }))
    })

    it('should handle non-ok response from gateway', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await retrieveFromIPFS(mockCid)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gateway returned status: 404')
    })

    it('should handle gateway timeout', async () => {
      // Make fetch hang
      vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
      
      vi.useFakeTimers()
      
      const retrievePromise = retrieveFromIPFS(mockCid)
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(10000)
      
      const result = await retrievePromise
      
      expect(result.success).toBe(false)
      
      vi.useRealTimers()
    })

    it('should handle complete failure across all methods', async () => {
      // Gateways fail
      vi.mocked(fetch).mockRejectedValue(new Error('Gateway error'))
      
      // Local Helia fails
      vi.mocked(create).mockRejectedValueOnce(new Error('Helia init failed'))

      const result = await retrieveFromIPFS(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('All retrieval methods failed')
      })
    })

    it('should handle local Helia retrieval error', async () => {
      // Gateways fail
      vi.mocked(fetch).mockRejectedValue(new Error('Gateway error'))
      
      // Local Helia throws during cat
      mockFs.cat.mockImplementationOnce(function* () {
        throw new Error('Cat failed')
      })

      const result = await retrieveFromIPFS(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Local IPFS error')
      })
    })

    it('should stop Helia node after local retrieval', async () => {
      // Make gateways fail to force local retrieval
      vi.mocked(fetch).mockRejectedValue(new Error('Gateway error'))

      await retrieveFromIPFS(mockCid)

      expect(mockHelia.stop).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty file upload', async () => {
      const emptyData = new Uint8Array(0)
      mockFs.addBytes.mockResolvedValue(mockCID)

      const result = await uploadToIPFS(emptyData, 'empty.txt')

      expect(result.success).toBe(true)
      expect(mockFs.addBytes).toHaveBeenCalledWith(emptyData)
    })

    it('should handle very large file names', async () => {
      const longFileName = 'a'.repeat(1000) + '.txt'
      mockFs.addBytes.mockResolvedValue(mockCID)

      const result = await uploadToIPFS(mockFileData, longFileName)

      expect(result.success).toBe(true)
    })

    it('should handle CID parsing errors', async () => {
      const invalidCid = 'invalid-cid'
      
      const result = await retrieveFromIPFS(invalidCid)

      // Should still attempt gateways even with invalid CID
      expect(fetch).toHaveBeenCalled()
    })
  })
})
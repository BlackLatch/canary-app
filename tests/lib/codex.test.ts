import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  uploadToCodex, 
  retrieveFromCodex, 
  checkCodexHealth, 
  type CodexUploadResult 
} from '@/app/lib/codex'
import { Codex } from '@codex-storage/sdk-js'

// Mock the Codex SDK
vi.mock('@codex-storage/sdk-js', () => ({
  Codex: vi.fn().mockImplementation(() => ({
    data: {
      upload: vi.fn()
    },
    debug: {
      info: vi.fn()
    }
  }))
}))

describe('Codex Service', () => {
  const mockFileData = new Uint8Array([1, 2, 3, 4, 5])
  const mockFileName = 'test.txt'
  const mockCid = 'codex-cid-123'
  let mockCodexInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    
    // Get the mocked instance
    mockCodexInstance = new Codex('http://localhost:8090/api/codex/v1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkCodexHealth', () => {
    it('should return healthy when Codex is accessible', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({
        id: 'node-123',
        addrs: ['/ip4/127.0.0.1/tcp/8090']
      })

      const result = await checkCodexHealth()

      expect(result).toBe(true)
      expect(mockCodexInstance.debug.info).toHaveBeenCalledOnce()
    })

    it('should return unhealthy when Codex is not accessible', async () => {
      mockCodexInstance.debug.info.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await checkCodexHealth()

      expect(result).toBe(false)
    })

    it('should handle timeout', async () => {
      // Make info call hang
      mockCodexInstance.debug.info.mockImplementationOnce(() => new Promise(() => {}))
      
      vi.useFakeTimers()
      
      const healthPromise = checkCodexHealth()
      
      // Fast-forward past timeout (5 seconds)
      vi.advanceTimersByTime(5000)
      
      const result = await healthPromise
      
      expect(result).toBe(false)
      
      vi.useRealTimers()
    })
  })

  describe('uploadToCodex', () => {
    it('should upload file successfully', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValueOnce(mockCid)

      const result = await uploadToCodex(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: true,
        cid: mockCid
      })

      expect(mockCodexInstance.data.upload).toHaveBeenCalledWith(
        expect.any(File),
        expect.any(Number),
        expect.any(Object)
      )
    })

    it('should handle Codex being offline', async () => {
      mockCodexInstance.debug.info.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await uploadToCodex(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: false,
        error: 'Codex node is not accessible'
      })

      expect(mockCodexInstance.data.upload).not.toHaveBeenCalled()
    })

    it('should handle upload failure', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockRejectedValueOnce(new Error('Upload failed'))

      const result = await uploadToCodex(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: false,
        error: 'Codex upload error: Upload failed'
      })
    })

    it('should handle upload timeout', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      // Make upload hang
      mockCodexInstance.data.upload.mockImplementationOnce(() => new Promise(() => {}))
      
      vi.useFakeTimers()
      
      const uploadPromise = uploadToCodex(mockFileData, mockFileName)
      
      // Fast-forward past timeout (30 seconds)
      vi.advanceTimersByTime(30000)
      
      const result = await uploadPromise
      
      expect(result).toMatchObject({
        success: false,
        error: 'Upload timeout - file may be too large or network is slow'
      })
      
      vi.useRealTimers()
    })

    it('should handle empty file upload', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValueOnce(mockCid)

      const emptyData = new Uint8Array(0)
      const result = await uploadToCodex(emptyData, 'empty.txt')

      expect(result.success).toBe(true)
    })

    it('should set correct MIME type for different files', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValueOnce(mockCid)

      let capturedFile: File | null = null
      mockCodexInstance.data.upload.mockImplementationOnce(async (file: File) => {
        capturedFile = file
        return mockCid
      })

      await uploadToCodex(mockFileData, 'image.png')

      expect(capturedFile).not.toBeNull()
      expect(capturedFile!.type).toBe('image/png')
    })

    it('should handle network errors', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      mockCodexInstance.data.upload.mockRejectedValueOnce(networkError)

      const result = await uploadToCodex(mockFileData, mockFileName)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Network error')
      })
    })
  })

  describe('retrieveFromCodex', () => {
    const mockCodexUrl = `http://localhost:8090/api/codex/v1/data/${mockCid}/network/stream`

    it('should retrieve file successfully', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      const mockData = new ArrayBuffer(5)
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockData)
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: true,
        data: new Uint8Array(mockData)
      })

      expect(fetch).toHaveBeenCalledWith(
        mockCodexUrl,
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should handle Codex being offline', async () => {
      mockCodexInstance.debug.info.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: 'Codex node is not accessible'
      })

      expect(fetch).not.toHaveBeenCalled()
    })

    it('should handle retrieval failure', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: 'Failed to retrieve from Codex: 404 Not Found'
      })
    })

    it('should handle retrieval timeout', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      // Make fetch hang
      vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
      
      vi.useFakeTimers()
      
      const retrievePromise = retrieveFromCodex(mockCid)
      
      // Fast-forward past timeout (10 seconds)
      vi.advanceTimersByTime(10000)
      
      const result = await retrievePromise
      
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('timeout')
      })
      
      vi.useRealTimers()
    })

    it('should handle fetch errors', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: 'Failed to retrieve from Codex: Network failure'
      })
    })

    it('should handle arrayBuffer conversion error', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockRejectedValue(new Error('Conversion failed'))
      }
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any)

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Conversion failed')
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle very large files', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValueOnce(mockCid)

      const largeData = new Uint8Array(100 * 1024 * 1024) // 100MB
      const result = await uploadToCodex(largeData, 'large.bin')

      expect(result.success).toBe(true)
    })

    it('should handle special characters in filename', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValueOnce(mockCid)

      const specialFileName = 'test file (1) [2] {3} #4 & more.txt'
      const result = await uploadToCodex(mockFileData, specialFileName)

      expect(result.success).toBe(true)
    })

    it('should handle invalid CID format', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })

      const invalidCid = ''
      const result = await retrieveFromCodex(invalidCid)

      // Should still try to fetch with empty CID
      expect(fetch).toHaveBeenCalled()
    })

    it('should handle concurrent uploads', async () => {
      mockCodexInstance.debug.info.mockResolvedValue({ id: 'node-123' })
      mockCodexInstance.data.upload.mockResolvedValue(mockCid)

      const promises = Array(5).fill(null).map((_, i) => 
        uploadToCodex(mockFileData, `file-${i}.txt`)
      )

      const results = await Promise.all(promises)

      expect(results.every(r => r.success)).toBe(true)
      expect(mockCodexInstance.data.upload).toHaveBeenCalledTimes(5)
    })

    it('should handle abort signal correctly', async () => {
      mockCodexInstance.debug.info.mockResolvedValueOnce({ id: 'node-123' })
      
      const abortError = new Error('The user aborted a request.')
      abortError.name = 'AbortError'
      vi.mocked(fetch).mockRejectedValueOnce(abortError)

      const result = await retrieveFromCodex(mockCid)

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('aborted')
      })
    })
  })
})
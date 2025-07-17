import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  CANARY_DOSSIER_ADDRESS,
  CANARY_DOSSIER_ABI,
  createDossier,
  getDossierDetails,
  checkIn,
  getUserDossiers,
  getNextDossierId,
  shouldDossierStayEncrypted,
  type DossierDetails
} from '@/app/lib/contract'
import { ethers } from 'ethers'
import { getWalletClient, readContract, writeContract, simulateContract } from '@wagmi/core'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { polygonAmoy } from 'wagmi/chains'

// Mock Wagmi core functions
vi.mock('@wagmi/core', () => ({
  getWalletClient: vi.fn(),
  readContract: vi.fn(),
  writeContract: vi.fn(),
  simulateContract: vi.fn()
}))

// Mock viem functions
vi.mock('viem', () => ({
  encodeFunctionData: vi.fn(),
  decodeFunctionResult: vi.fn(),
  parseAbi: vi.fn(abi => abi)
}))

describe('Contract Service', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockWalletClient = {
    account: { address: mockAddress },
    chain: polygonAmoy
  }
  const mockTxHash = '0xabcdef1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWalletClient).mockResolvedValue(mockWalletClient as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createDossier', () => {
    const mockDossierId = BigInt(123)

    it('should create a dossier successfully', async () => {
      vi.mocked(simulateContract).mockResolvedValueOnce({
        request: { functionName: 'createDossier' }
      } as any)
      vi.mocked(writeContract).mockResolvedValueOnce(mockTxHash)
      vi.mocked(readContract).mockResolvedValueOnce(mockDossierId)

      const result = await createDossier('keyword123', 7 * 24 * 60 * 60) // 7 days

      expect(result).toBe(mockDossierId)

      expect(simulateContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'createDossier',
        args: ['keyword123', BigInt(7 * 24 * 60 * 60)],
        account: mockAddress
      })

      expect(writeContract).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
        functionName: 'createDossier'
      }))

      expect(readContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'nextDossierId',
        account: mockAddress
      })
    })

    it('should throw error when no wallet is connected', async () => {
      vi.mocked(getWalletClient).mockResolvedValueOnce(null)

      await expect(createDossier('keyword', 3600)).rejects.toThrow('No wallet connected')
    })

    it('should handle contract simulation failure', async () => {
      vi.mocked(simulateContract).mockRejectedValueOnce(new Error('Simulation failed'))

      await expect(createDossier('keyword', 3600)).rejects.toThrow('Simulation failed')
    })

    it('should handle write contract failure', async () => {
      vi.mocked(simulateContract).mockResolvedValueOnce({
        request: { functionName: 'createDossier' }
      } as any)
      vi.mocked(writeContract).mockRejectedValueOnce(new Error('Transaction rejected'))

      await expect(createDossier('keyword', 3600)).rejects.toThrow('Transaction rejected')
    })
  })

  describe('getDossierDetails', () => {
    const mockDossierId = BigInt(42)
    const mockDossierData: DossierDetails = {
      owner: mockAddress,
      checkInInterval: BigInt(7 * 24 * 60 * 60),
      lastCheckIn: BigInt(Date.now() / 1000),
      keyword: 'secret123',
      active: true
    }

    it('should get dossier details successfully', async () => {
      vi.mocked(readContract).mockResolvedValueOnce(mockDossierData)

      const result = await getDossierDetails(mockDossierId)

      expect(result).toEqual(mockDossierData)

      expect(readContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'getDossier',
        args: [mockDossierId]
      })
    })

    it('should handle read contract failure', async () => {
      vi.mocked(readContract).mockRejectedValueOnce(new Error('Read failed'))

      await expect(getDossierDetails(mockDossierId)).rejects.toThrow('Read failed')
    })

    it('should handle non-existent dossier', async () => {
      vi.mocked(readContract).mockResolvedValueOnce({
        owner: '0x0000000000000000000000000000000000000000',
        checkInInterval: BigInt(0),
        lastCheckIn: BigInt(0),
        keyword: '',
        active: false
      })

      const result = await getDossierDetails(mockDossierId)

      expect(result.active).toBe(false)
    })
  })

  describe('checkIn', () => {
    const mockDossierId = BigInt(123)
    const mockKeyword = 'secret123'

    it('should check in successfully', async () => {
      vi.mocked(simulateContract).mockResolvedValueOnce({
        request: { functionName: 'checkIn' }
      } as any)
      vi.mocked(writeContract).mockResolvedValueOnce(mockTxHash)

      const result = await checkIn(mockDossierId, mockKeyword)

      expect(result).toBe(mockTxHash)

      expect(simulateContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'checkIn',
        args: [mockDossierId, mockKeyword],
        account: mockAddress
      })
    })

    it('should throw error when no wallet is connected', async () => {
      vi.mocked(getWalletClient).mockResolvedValueOnce(null)

      await expect(checkIn(mockDossierId, mockKeyword)).rejects.toThrow('No wallet connected')
    })

    it('should handle incorrect keyword', async () => {
      vi.mocked(simulateContract).mockRejectedValueOnce(new Error('Incorrect keyword'))

      await expect(checkIn(mockDossierId, 'wrongKeyword')).rejects.toThrow('Incorrect keyword')
    })
  })

  describe('getUserDossiers', () => {
    const mockDossierIds = [BigInt(1), BigInt(2), BigInt(3)]

    it('should get user dossiers successfully', async () => {
      vi.mocked(readContract).mockResolvedValueOnce(mockDossierIds)

      const result = await getUserDossiers(mockAddress)

      expect(result).toEqual(mockDossierIds)

      expect(readContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'getUserDossiers',
        args: [mockAddress]
      })
    })

    it('should return empty array for user with no dossiers', async () => {
      vi.mocked(readContract).mockResolvedValueOnce([])

      const result = await getUserDossiers(mockAddress)

      expect(result).toEqual([])
    })

    it('should handle read failure', async () => {
      vi.mocked(readContract).mockRejectedValueOnce(new Error('Read failed'))

      await expect(getUserDossiers(mockAddress)).rejects.toThrow('Read failed')
    })
  })

  describe('getNextDossierId', () => {
    const mockNextId = BigInt(456)

    it('should get next dossier ID successfully', async () => {
      vi.mocked(readContract).mockResolvedValueOnce(mockNextId)

      const result = await getNextDossierId()

      expect(result).toBe(mockNextId)

      expect(readContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'nextDossierId'
      })
    })

    it('should handle read failure', async () => {
      vi.mocked(readContract).mockRejectedValueOnce(new Error('Read failed'))

      await expect(getNextDossierId()).rejects.toThrow('Read failed')
    })
  })

  describe('shouldDossierStayEncrypted', () => {
    const mockDossierId = BigInt(789)
    const mockUserAddress = '0xabcdef1234567890123456789012345678901234'

    it('should return true when dossier should stay encrypted', async () => {
      vi.mocked(readContract).mockResolvedValueOnce(true)

      const result = await shouldDossierStayEncrypted(mockUserAddress, mockDossierId)

      expect(result).toBe(true)

      expect(readContract).toHaveBeenCalledWith(expect.any(Object), {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'shouldDossierStayEncrypted',
        args: [mockUserAddress, mockDossierId]
      })
    })

    it('should return false when dossier can be decrypted', async () => {
      vi.mocked(readContract).mockResolvedValueOnce(false)

      const result = await shouldDossierStayEncrypted(mockUserAddress, mockDossierId)

      expect(result).toBe(false)
    })

    it('should handle read failure', async () => {
      vi.mocked(readContract).mockRejectedValueOnce(new Error('Read failed'))

      await expect(
        shouldDossierStayEncrypted(mockUserAddress, mockDossierId)
      ).rejects.toThrow('Read failed')
    })
  })

  describe('Edge cases', () => {
    it('should handle zero dossier ID', async () => {
      const zeroDossierId = BigInt(0)
      vi.mocked(readContract).mockResolvedValueOnce({
        owner: '0x0000000000000000000000000000000000000000',
        checkInInterval: BigInt(0),
        lastCheckIn: BigInt(0),
        keyword: '',
        active: false
      })

      const result = await getDossierDetails(zeroDossierId)
      
      expect(result.active).toBe(false)
    })

    it('should handle very large check-in intervals', async () => {
      const yearInSeconds = BigInt(365 * 24 * 60 * 60)
      vi.mocked(simulateContract).mockResolvedValueOnce({
        request: { functionName: 'createDossier' }
      } as any)
      vi.mocked(writeContract).mockResolvedValueOnce(mockTxHash)
      vi.mocked(readContract).mockResolvedValueOnce(BigInt(1))

      const result = await createDossier('keyword', Number(yearInSeconds))

      expect(result).toBe(BigInt(1))
    })

    it('should handle empty keyword', async () => {
      vi.mocked(simulateContract).mockRejectedValueOnce(new Error('Empty keyword not allowed'))

      await expect(createDossier('', 3600)).rejects.toThrow('Empty keyword not allowed')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      vi.mocked(readContract).mockRejectedValueOnce(networkError)

      await expect(getNextDossierId()).rejects.toThrow('Network error')
    })

    it('should handle user rejection', async () => {
      const userRejection = new Error('User rejected the request')
      userRejection.name = 'UserRejectedRequestError'
      vi.mocked(simulateContract).mockRejectedValueOnce(userRejection)

      await expect(createDossier('keyword', 3600)).rejects.toThrow('User rejected')
    })

    it('should handle multiple simultaneous calls', async () => {
      vi.mocked(readContract).mockResolvedValue([BigInt(1), BigInt(2)])

      const promises = Array(5).fill(null).map(() => 
        getUserDossiers(mockAddress)
      )

      const results = await Promise.all(promises)

      expect(results.every(r => r.length === 2)).toBe(true)
      expect(readContract).toHaveBeenCalledTimes(5)
    })
  })
})
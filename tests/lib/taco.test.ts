import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  tacoService,
  encryptFileWithDossier,
  commitEncryptedFile,
  commitEncryptedFileToPinata,
  initializeTaco,
  type DeadmanCondition,
  type EncryptionResult
} from '@/app/lib/taco'
import * as tacoLib from '@nucypher/taco'
import * as codexLib from '@/app/lib/codex'
import * as pinataLib from '@/app/lib/pinata'
import * as ipfsLib from '@/app/lib/ipfs'
import * as ethersAdapter from '@/app/lib/ethers-adapter'
import { ethers } from 'ethers'

// Mock all dependencies
vi.mock('@nucypher/taco', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  initialize: vi.fn(),
  conditions: {
    base: {
      contract: {
        ContractCondition: vi.fn().mockImplementation((params) => ({ ...params, type: 'contract' }))
      }
    },
    context: {
      ConditionContext: {
        fromMessageKit: vi.fn().mockReturnValue({
          addAuthProvider: vi.fn()
        })
      }
    }
  },
  domains: {
    DEVNET: 'devnet-domain'
  }
}))

vi.mock('@nucypher/taco-auth', () => ({
  EIP4361AuthProvider: vi.fn().mockImplementation(() => ({ type: 'eip4361' })),
  USER_ADDRESS_PARAM_DEFAULT: 'user_address'
}))

vi.mock('@/app/lib/codex', () => ({
  uploadToCodex: vi.fn()
}))

vi.mock('@/app/lib/pinata', () => ({
  uploadToPinata: vi.fn()
}))

vi.mock('@/app/lib/ipfs', () => ({
  uploadToIPFS: vi.fn()
}))

vi.mock('@/app/lib/ethers-adapter', () => ({
  getPrivyEthersProvider: vi.fn()
}))

describe('TACo Service', () => {
  const mockProvider = {
    getSigner: vi.fn().mockReturnValue({ address: '0x123' })
  }

  const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
  const mockCondition: DeadmanCondition = {
    type: 'no_activity',
    duration: '7 days',
    dossierId: BigInt(1),
    userAddress: '0x123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ethersAdapter.getPrivyEthersProvider).mockResolvedValue(mockProvider as any)
    vi.mocked(tacoLib.initialize).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initializeTaco', () => {
    it('should initialize TACo successfully', async () => {
      const result = await initializeTaco()
      
      expect(result).toBe(true)
      expect(tacoLib.initialize).toHaveBeenCalledOnce()
    })

    it('should return false on initialization failure', async () => {
      vi.mocked(tacoLib.initialize).mockRejectedValueOnce(new Error('Init failed'))
      
      const result = await initializeTaco()
      
      expect(result).toBe(false)
    })
  })

  describe('encryptFileWithDossier', () => {
    const mockMessageKit = {
      toBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
    }

    beforeEach(() => {
      vi.mocked(tacoLib.encrypt).mockResolvedValue(mockMessageKit as any)
    })

    it('should encrypt a file successfully', async () => {
      const result = await encryptFileWithDossier(
        mockFile,
        mockCondition,
        'Test description',
        BigInt(1),
        '0x123'
      )

      expect(result).toMatchObject({
        messageKit: mockMessageKit,
        encryptedData: new Uint8Array([1, 2, 3]),
        originalFileName: 'test.txt',
        description: 'Test description',
        condition: expect.objectContaining({
          dossierId: BigInt(1),
          userAddress: '0x123'
        })
      })

      expect(tacoLib.encrypt).toHaveBeenCalledWith(
        mockProvider,
        'devnet-domain',
        expect.any(Uint8Array),
        expect.objectContaining({ type: 'contract' }),
        27, // RITUAL_ID
        mockProvider.getSigner()
      )
    })

    it('should throw error when no wallet is connected', async () => {
      vi.mocked(ethersAdapter.getPrivyEthersProvider).mockRejectedValueOnce(
        new Error('No wallet connected. Please connect your wallet.')
      )

      await expect(
        encryptFileWithDossier(mockFile, mockCondition, 'Test', BigInt(1), '0x123')
      ).rejects.toThrow('No wallet connected')
    })

    it('should create proper Dossier condition', async () => {
      const ContractConditionMock = vi.mocked(tacoLib.conditions.base.contract.ContractCondition)
      
      await encryptFileWithDossier(
        mockFile,
        mockCondition,
        'Test',
        BigInt(42),
        '0xABC'
      )

      expect(ContractConditionMock).toHaveBeenCalledWith({
        contractAddress: expect.any(String),
        chain: 80002, // Polygon Amoy chain ID
        functionAbi: expect.objectContaining({
          name: 'shouldDossierStayEncrypted',
          inputs: expect.arrayContaining([
            { name: '_user', type: 'address', internalType: 'address' },
            { name: '_dossierId', type: 'uint256', internalType: 'uint256' }
          ])
        }),
        method: 'shouldDossierStayEncrypted',
        parameters: ['0xABC', '42'],
        returnValueTest: {
          comparator: '==',
          value: false
        }
      })
    })
  })

  describe('decryptFile', () => {
    const mockMessageKit = { data: 'encrypted' }
    const mockDecryptedData = new Uint8Array([4, 5, 6])

    beforeEach(() => {
      vi.mocked(tacoLib.decrypt).mockResolvedValue(mockDecryptedData)
    })

    it('should decrypt a file successfully', async () => {
      const result = await tacoService.decryptFile(mockMessageKit)

      expect(result).toEqual(mockDecryptedData)
      expect(tacoLib.decrypt).toHaveBeenCalledWith(
        mockProvider,
        'devnet-domain',
        mockMessageKit,
        expect.any(Object)
      )
    })

    it('should clear cached auth data before decryption', async () => {
      const removeItemSpy = vi.spyOn(localStorage, 'removeItem')
      
      await tacoService.decryptFile(mockMessageKit)

      expect(removeItemSpy).toHaveBeenCalledWith('siwe')
      expect(removeItemSpy).toHaveBeenCalledWith('taco-auth')
      expect(removeItemSpy).toHaveBeenCalledWith('eip4361')
    })

    it('should handle localStorage errors gracefully', async () => {
      vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      // Should not throw
      await expect(tacoService.decryptFile(mockMessageKit)).resolves.toEqual(mockDecryptedData)
    })
  })

  describe('commitToPinataOnly', () => {
    const mockEncryptionResult: EncryptionResult = {
      messageKit: { data: 'kit' },
      encryptedData: new Uint8Array([1, 2, 3]),
      originalFileName: 'test.txt',
      condition: mockCondition,
      description: 'Test',
      capsuleUri: 'taco://test'
    }

    it('should commit to Pinata successfully', async () => {
      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: true,
        ipfsHash: 'QmTest123',
        gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmTest123'
      })

      const result = await tacoService.commitToPinataOnly(mockEncryptionResult)

      expect(result).toMatchObject({
        encryptionResult: mockEncryptionResult,
        pinataCid: 'QmTest123',
        payloadUri: 'ipfs://QmTest123',
        storageType: 'pinata'
      })

      expect(pinataLib.uploadToPinata).toHaveBeenCalledWith(
        mockEncryptionResult.encryptedData,
        'test.txt.encrypted'
      )
    })

    it('should throw error on Pinata upload failure', async () => {
      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: false,
        error: 'Upload failed'
      })

      await expect(
        tacoService.commitToPinataOnly(mockEncryptionResult)
      ).rejects.toThrow('Pinata upload failed: Upload failed')
    })
  })

  describe('commitToCodex with fallbacks', () => {
    const mockEncryptionResult: EncryptionResult = {
      messageKit: { data: 'kit' },
      encryptedData: new Uint8Array([1, 2, 3]),
      originalFileName: 'test.txt',
      condition: mockCondition,
      description: 'Test',
      capsuleUri: 'taco://test'
    }

    it('should commit to Codex successfully', async () => {
      vi.mocked(codexLib.uploadToCodex).mockResolvedValue({
        success: true,
        cid: 'codex-cid-123'
      })

      const result = await tacoService.commitToCodex(mockEncryptionResult)

      expect(result).toMatchObject({
        encryptionResult: mockEncryptionResult,
        codexCid: 'codex-cid-123',
        payloadUri: 'codex://codex-cid-123',
        storageType: 'codex'
      })
    })

    it('should fallback to Pinata when Codex fails', async () => {
      vi.mocked(codexLib.uploadToCodex).mockResolvedValue({
        success: false,
        error: 'Codex offline'
      })
      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: true,
        ipfsHash: 'QmPinata456',
        gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmPinata456'
      })

      const result = await tacoService.commitToCodex(mockEncryptionResult)

      expect(result).toMatchObject({
        pinataCid: 'QmPinata456',
        payloadUri: 'ipfs://QmPinata456',
        storageType: 'pinata'
      })
    })

    it('should fallback to local IPFS when both Codex and Pinata fail', async () => {
      vi.mocked(codexLib.uploadToCodex).mockResolvedValue({
        success: false,
        error: 'Codex offline'
      })
      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: false,
        error: 'Pinata error'
      })
      vi.mocked(ipfsLib.uploadToIPFS).mockResolvedValue({
        success: true,
        cid: 'QmIPFS789',
        gatewayUrl: 'https://ipfs.io/ipfs/QmIPFS789',
        gatewayUsed: 'primary' as const
      })

      const result = await tacoService.commitToCodex(mockEncryptionResult)

      expect(result).toMatchObject({
        ipfsCid: 'QmIPFS789',
        payloadUri: 'ipfs://QmIPFS789',
        storageType: 'ipfs'
      })
    })

    it('should throw error when all storage methods fail', async () => {
      vi.mocked(codexLib.uploadToCodex).mockResolvedValue({
        success: false,
        error: 'Codex offline'
      })
      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: false,
        error: 'Pinata error'
      })
      vi.mocked(ipfsLib.uploadToIPFS).mockResolvedValue({
        success: false,
        error: 'IPFS error'
      })

      await expect(
        tacoService.commitToCodex(mockEncryptionResult)
      ).rejects.toThrow('Commit failed: no storage backend available')
    })
  })

  describe('createTraceJson', () => {
    it('should create trace JSON with Pinata gateway', () => {
      const commitResult = {
        encryptionResult: {
          condition: {
            ...mockCondition,
            dossierId: BigInt(123),
            userAddress: '0xUser'
          },
          description: 'Test file',
          capsuleUri: 'taco://capsule-123'
        },
        payloadUri: 'ipfs://QmTest',
        storageType: 'pinata' as const,
        pinataUploadResult: {
          success: true,
          ipfsHash: 'QmTest',
          gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmTest'
        }
      }

      const trace = tacoService.createTraceJson(commitResult as any)

      expect(trace).toMatchObject({
        payload_uri: 'ipfs://QmTest',
        taco_capsule_uri: 'taco://capsule-123',
        condition: expect.stringContaining('Dossier #123'),
        description: 'Test file',
        storage_type: 'pinata',
        gateway_url: 'https://gateway.pinata.cloud/ipfs/QmTest',
        gatewayUsed: 'primary',
        dossier_id: '123',
        user_address: '0xUser',
        contract_address: expect.any(String)
      })
    })

    it('should create trace JSON with IPFS secondary gateway', () => {
      const commitResult = {
        encryptionResult: {
          condition: mockCondition,
          description: 'Test file',
          capsuleUri: 'taco://capsule-456'
        },
        payloadUri: 'ipfs://QmIPFS',
        storageType: 'ipfs' as const,
        ipfsUploadResult: {
          success: true,
          cid: 'QmIPFS',
          gatewayUrl: 'https://dweb.link/ipfs/QmIPFS',
          gatewayUsed: 'secondary' as const
        }
      }

      const trace = tacoService.createTraceJson(commitResult as any)

      expect(trace.gatewayUsed).toBe('secondary')
      expect(trace.gateway_url).toBe('https://dweb.link/ipfs/QmIPFS')
    })
  })

  describe('Helper functions', () => {
    it('commitEncryptedFile should use commitToCodex', async () => {
      const mockEncryptionResult: EncryptionResult = {
        messageKit: { data: 'kit' },
        encryptedData: new Uint8Array([1, 2, 3]),
        originalFileName: 'test.txt',
        condition: mockCondition,
        description: 'Test',
        capsuleUri: 'taco://test'
      }

      vi.mocked(codexLib.uploadToCodex).mockResolvedValue({
        success: true,
        cid: 'codex-123'
      })

      const result = await commitEncryptedFile(mockEncryptionResult)

      expect(result).toHaveProperty('commitResult')
      expect(result).toHaveProperty('traceJson')
      expect(result.commitResult.storageType).toBe('codex')
    })

    it('commitEncryptedFileToPinata should use commitToPinataOnly', async () => {
      const mockEncryptionResult: EncryptionResult = {
        messageKit: { data: 'kit' },
        encryptedData: new Uint8Array([1, 2, 3]),
        originalFileName: 'test.txt',
        condition: mockCondition,
        description: 'Test',
        capsuleUri: 'taco://test'
      }

      vi.mocked(pinataLib.uploadToPinata).mockResolvedValue({
        success: true,
        ipfsHash: 'QmPinata',
        gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmPinata'
      })

      const result = await commitEncryptedFileToPinata(mockEncryptionResult)

      expect(result).toHaveProperty('commitResult')
      expect(result).toHaveProperty('traceJson')
      expect(result.commitResult.storageType).toBe('pinata')
    })
  })
})
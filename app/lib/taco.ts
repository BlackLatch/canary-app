// Enhanced TACo integration with Dossier contract conditions
import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, CodexUploadResult } from './codex';
import { uploadToPinata, PinataUploadResult } from './pinata';
import { uploadToIPFS, IPFSUploadResult } from './ipfs';
import { CANARY_DOSSIER_ADDRESS, CANARY_DOSSIER_ABI } from './contract';
import { polygonAmoy } from 'wagmi/chains';
import { getPrivyEthersProvider } from './ethers-adapter';

// TACo Configuration
const TACO_DOMAIN = domains.DEVNET;
const RITUAL_ID = 27;

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
  // Dossier integration fields
  dossierId: bigint;
  userAddress: string;
}

export interface EncryptionResult {
  messageKit: any;
  encryptedData: Uint8Array;
  originalFileName: string;
  condition: DeadmanCondition;
  description: string;
  capsuleUri: string;
}

export interface CommitResult {
  encryptionResult: EncryptionResult;
  codexCid?: string;
  codexUploadResult?: CodexUploadResult;
  ipfsCid?: string;
  ipfsUploadResult?: IPFSUploadResult;
  pinataCid?: string;
  pinataUploadResult?: PinataUploadResult;
  payloadUri: string;
  storageType: 'codex' | 'ipfs' | 'pinata';
}

export interface TraceJson {
  payload_uri: string;
  taco_capsule_uri: string;
  condition: string;
  description: string;
  storage_type: 'codex' | 'ipfs' | 'pinata';
  gateway_url?: string;
  gatewayUsed?: 'primary' | 'secondary';
  created_at: string;
  // Dossier integration fields
  dossier_id: string;
  user_address: string;
  contract_address: string;
}

class TacoService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      await initialize();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('TACo initialization failed:', error);
      return false;
    }
  }

  /**
   * Create a Dossier contract condition that checks shouldDossierStayEncrypted
   * This is the primary and only method for creating secure conditions
   */
  private createDossierCondition(userAddress: string, dossierId: bigint) {
    console.log(`🔒 Creating Dossier condition: user=${userAddress}, dossier=${dossierId.toString()}`);
    console.log(`📍 Contract: ${CANARY_DOSSIER_ADDRESS} on chain ${polygonAmoy.id}`);
    
    // Create a contract condition that calls shouldDossierStayEncrypted
    // This will return true if encryption should remain, false if decryption is allowed
    return new conditions.base.contract.ContractCondition({
      contractAddress: CANARY_DOSSIER_ADDRESS,
      chain: polygonAmoy.id, // Polygon Amoy where our contract is deployed
      functionAbi: {
        name: 'shouldDossierStayEncrypted',
        type: 'function',
        inputs: [
          { name: '_user', type: 'address', internalType: 'address' },
          { name: '_dossierId', type: 'uint256', internalType: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
        stateMutability: 'view'
      },
      method: 'shouldDossierStayEncrypted',
      parameters: [userAddress, dossierId.toString()],
      returnValueTest: {
        comparator: '==',
        value: false, // Decryption allowed when function returns false (check-in missed)
      },
    });
  }

  /**
   * Encrypt file with Dossier contract condition
   * This is the only method for encrypting files with full security
   */
  async encryptFile(
    file: File,
    condition: DeadmanCondition,
    description: string,
    dossierId: bigint,
    userAddress: string,
    walletProvider?: any
  ): Promise<EncryptionResult> {
    await this.initialize();

    // Get the ethers provider from Privy (handles embedded wallets)
    const provider = await getPrivyEthersProvider(walletProvider);
    
    // Get the signer - for embedded wallets, we should use the default signer
    // not the smart wallet address
    console.log('🔐 Getting signer from provider...');
    const signer = provider.getSigner(); // Don't pass address, let provider use its default
    
    // Log the actual signer address for debugging
    try {
      const signerAddress = await signer.getAddress();
      console.log('📍 Signer address:', signerAddress);
    } catch (error) {
      console.warn('⚠️ Could not get signer address:', error);
    }
    
    console.log('🔒 Using Dossier contract condition for maximum security');
    const tacoCondition = this.createDossierCondition(userAddress, dossierId);

    const fileArrayBuffer = await file.arrayBuffer();
    const message = new Uint8Array(fileArrayBuffer);

    console.log('🔐 Encrypting with Dossier condition:', {
      type: 'dossier_contract',
      dossierId: dossierId.toString(),
      userAddress: userAddress,
      contractAddress: CANARY_DOSSIER_ADDRESS
    });

    const messageKit = await encrypt(
      provider,
      TACO_DOMAIN,
      message,
      tacoCondition,
      RITUAL_ID,
      signer
    );

    console.log('✅ Encryption successful with Dossier contract integration');

    // Add dossier information to condition
    const enhancedCondition = {
      ...condition,
      dossierId,
      userAddress
    };

    return {
      messageKit,
      encryptedData: messageKit.toBytes(),
      originalFileName: file.name,
      condition: enhancedCondition,
      description,
      capsuleUri: `taco://dossier-${dossierId.toString()}-${Date.now()}`,
    };
  }

  async decryptFile(messageKit: any): Promise<Uint8Array> {
    // Clear any cached auth data
    try {
      localStorage.removeItem('siwe');
      localStorage.removeItem('taco-auth');
      localStorage.removeItem('eip4361');
    } catch (e) {
      // Ignore storage errors
    }

    // Get the ethers provider from Privy (handles embedded wallets)
    const provider = await getPrivyEthersProvider();
    const signer = provider.getSigner();

    console.log('🔓 Attempting decryption with contract verification...');

    const conditionContext = conditions.context.ConditionContext.fromMessageKit(messageKit);
    const authProvider = new EIP4361AuthProvider(
      provider,
      signer,
    );
    conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

    // The TACo network will automatically verify the condition
    // The Dossier condition will call shouldDossierStayEncrypted
    const decryptedMessage = await decrypt(
      provider,
      TACO_DOMAIN,
      messageKit,
      conditionContext,
    );

    console.log('✅ Decryption successful - dossier conditions verified');
    return decryptedMessage;
  }

  // Storage methods remain unchanged
  async commitToPinataOnly(encryptionResult: EncryptionResult): Promise<CommitResult> {
    try {
      console.log('🟣 Uploading to Pinata...');
      
      const pinataUploadResult = await uploadToPinata(
        encryptionResult.encryptedData,
        `${encryptionResult.originalFileName}.encrypted`
      );

      if (pinataUploadResult.success) {
        console.log('✅ Pinata upload successful:', pinataUploadResult.ipfsHash);
        return {
          encryptionResult,
          pinataCid: pinataUploadResult.ipfsHash,
          pinataUploadResult,
          payloadUri: `ipfs://${pinataUploadResult.ipfsHash}`,
          storageType: 'pinata'
        };
      } else {
        throw new Error(`Pinata upload failed: ${pinataUploadResult.error}`);
      }
    } catch (error) {
      console.error('❌ Pinata upload failed:', error);
      throw new Error(`Storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async commitToCodex(encryptionResult: EncryptionResult): Promise<CommitResult> {
    try {
      const codexUploadResult = await uploadToCodex(
        encryptionResult.encryptedData, 
        `${encryptionResult.originalFileName}.encrypted`
      );

      if (codexUploadResult.success) {
        return {
          encryptionResult,
          codexCid: codexUploadResult.cid,
          codexUploadResult,
          payloadUri: `codex://${codexUploadResult.cid}`,
          storageType: 'codex'
        };
      } else {
        // Try Pinata fallback
        const pinataUploadResult = await uploadToPinata(
          encryptionResult.encryptedData,
          `${encryptionResult.originalFileName}.encrypted`
        );

        if (pinataUploadResult.success) {
          return {
            encryptionResult,
            codexUploadResult,
            pinataCid: pinataUploadResult.ipfsHash,
            pinataUploadResult,
            payloadUri: `ipfs://${pinataUploadResult.ipfsHash}`,
            storageType: 'pinata'
          };
        } else {
          // Try local IPFS fallback
          const ipfsUploadResult = await uploadToIPFS(
            encryptionResult.encryptedData,
            `${encryptionResult.originalFileName}.encrypted`
          );

          if (ipfsUploadResult.success) {
            return {
              encryptionResult,
              codexUploadResult,
              ipfsCid: ipfsUploadResult.cid,
              ipfsUploadResult,
              payloadUri: `ipfs://${ipfsUploadResult.cid}`,
              storageType: 'ipfs'
            };
          }
        }
      }
    } catch (error) {
      console.error('Commit failed:', error);
      throw new Error('All storage methods failed. Unable to securely store encrypted file.');
    }

    // Should never reach here
    throw new Error('Commit failed: no storage backend available');
  }

  createTraceJson(commitResult: CommitResult): TraceJson {
    const conditionText = this.formatConditionText(commitResult.encryptionResult.condition);
    
    let gatewayUrl: string | undefined;
    let gatewayUsed: 'primary' | 'secondary' | undefined;
    
    if (commitResult.pinataUploadResult?.success) {
      gatewayUrl = commitResult.pinataUploadResult.gatewayUrl;
      gatewayUsed = 'primary';
    } else if (commitResult.ipfsUploadResult?.success) {
      gatewayUrl = commitResult.ipfsUploadResult.gatewayUrl;
      gatewayUsed = commitResult.ipfsUploadResult.gatewayUsed;
    }
    
    const condition = commitResult.encryptionResult.condition;
    
    return {
      payload_uri: commitResult.payloadUri,
      taco_capsule_uri: commitResult.encryptionResult.capsuleUri,
      condition: conditionText,
      description: commitResult.encryptionResult.description || 'Encrypted file with dossier conditions',
      storage_type: commitResult.storageType,
      gateway_url: gatewayUrl,
      gatewayUsed: gatewayUsed,
      created_at: new Date().toISOString(),
      // Dossier integration metadata (required)
      dossier_id: condition.dossierId.toString(),
      user_address: condition.userAddress,
      contract_address: CANARY_DOSSIER_ADDRESS,
    };
  }

  private formatConditionText(condition: DeadmanCondition): string {
    return `Dossier #${condition.dossierId.toString()} contract verification (${condition.duration || 'contract-defined interval'})`;
  }
}

// Export singleton instance
export const tacoService = new TacoService();

/**
 * Enhanced encryption function that integrates with Dossier contract
 * This is the only method for maximum security
 */
export async function encryptFileWithDossier(
  file: File,
  condition: DeadmanCondition,
  description: string = '',
  dossierId: bigint,
  userAddress: string,
  walletProvider?: any
): Promise<EncryptionResult> {
  return await tacoService.encryptFile(file, condition, description, dossierId, userAddress, walletProvider);
}

// Storage functions remain unchanged
export async function commitEncryptedFile(
  encryptionResult: EncryptionResult
): Promise<{ commitResult: CommitResult; traceJson: TraceJson }> {
  const commitResult = await tacoService.commitToCodex(encryptionResult);
  const traceJson = tacoService.createTraceJson(commitResult);
  
  return { commitResult, traceJson };
}

export async function commitEncryptedFileToPinata(
  encryptionResult: EncryptionResult
): Promise<{ commitResult: CommitResult; traceJson: TraceJson }> {
  const commitResult = await tacoService.commitToPinataOnly(encryptionResult);
  const traceJson = tacoService.createTraceJson(commitResult);
  
  return { commitResult, traceJson };
}

export async function initializeTaco(): Promise<boolean> {
  return await tacoService.initialize();
} 
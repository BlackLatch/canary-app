// Enhanced TACo integration with Dossier contract conditions
import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, CodexUploadResult } from './codex';
import { uploadToPinata, PinataUploadResult } from './pinata';
import { uploadToIPFS, IPFSUploadResult } from './ipfs';
import { CANARY_DOSSIER_ADDRESS, CANARY_DOSSIER_ABI } from './contract';
import { polygonAmoy } from 'wagmi/chains';

// TACo Configuration
const TACO_DOMAIN = domains.DEVNET;
const RITUAL_ID = 27;

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
  // New field for dossier integration
  dossierId?: bigint;
  userAddress?: string;
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
  // New fields for dossier integration
  dossier_id?: string;
  user_address?: string;
  contract_address?: string;
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
   * Create a custom condition that checks the Dossier contract
   * This replaces simple time-based conditions with contract state verification
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
   * Fallback: Create a simple time condition for compatibility
   * Used when dossier integration is not available
   */
  private createTimeCondition(durationMinutes: number = 1) {
    const futureTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);
    
    console.log(`⏰ Fallback time condition: ${durationMinutes}m (expires ${new Date(futureTimestamp * 1000).toLocaleTimeString()})`);
    
    return new conditions.base.time.TimeCondition({
      chain: polygonAmoy.id, // Use Polygon Amoy for consistency
      method: 'blocktime',
      returnValueTest: {
        comparator: '>',
        value: futureTimestamp,
      },
    });
  }

  private parseDurationToMinutes(duration: string): number {
    const match = duration.match(/(\d+)\s*(DAYS?|HOURS?|MINUTES?)/i);
    if (!match) return 1;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('day')) return value * 24 * 60;
    if (unit.startsWith('hour')) return value * 60;
    if (unit.startsWith('minute')) return value;
    
    return 1;
  }

  async encryptFile(
    file: File, 
    condition: DeadmanCondition, 
    description: string
  ): Promise<EncryptionResult> {
    await this.initialize();

    if (!window.ethereum) {
      throw new Error('No Web3 provider found');
    }

    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    
    let tacoCondition;
    
    // Use Dossier contract condition if we have the required data
    if (condition.dossierId && condition.userAddress) {
      console.log('🔒 Using Dossier contract condition for enhanced security');
      tacoCondition = this.createDossierCondition(condition.userAddress, condition.dossierId);
    } else {
      console.log('⚠️ Using fallback time condition (less secure)');
      const durationMinutes = this.parseDurationToMinutes(condition.duration || '1 MINUTE');
      tacoCondition = this.createTimeCondition(durationMinutes);
    }

    const fileArrayBuffer = await file.arrayBuffer();
    const message = new Uint8Array(fileArrayBuffer);

    console.log('🔐 Encrypting with condition:', {
      type: condition.dossierId ? 'dossier' : 'time',
      dossierId: condition.dossierId?.toString(),
      userAddress: condition.userAddress,
      contractAddress: condition.dossierId ? CANARY_DOSSIER_ADDRESS : undefined
    });

    const messageKit = await encrypt(
      web3Provider,
      TACO_DOMAIN,
      message,
      tacoCondition,
      RITUAL_ID,
      web3Provider.getSigner()
    );

    console.log('✅ Encryption successful with Dossier integration');

    return {
      messageKit,
      encryptedData: messageKit.toBytes(),
      originalFileName: file.name,
      condition,
      description,
      capsuleUri: `taco://dossier-${condition.dossierId || 'time'}-${Date.now()}`,
    };
  }

  async decryptFile(messageKit: any): Promise<Uint8Array> {
    if (!window.ethereum) {
      throw new Error('No Web3 provider found');
    }

    // Clear any cached auth data
    try {
      localStorage.removeItem('siwe');
      localStorage.removeItem('taco-auth');
      localStorage.removeItem('eip4361');
    } catch (e) {
      // Ignore storage errors
    }

    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    await web3Provider.send("eth_requestAccounts", []);

    console.log('🔓 Attempting decryption with Dossier contract verification...');

    const conditionContext = conditions.context.ConditionContext.fromMessageKit(messageKit);
    const authProvider = new EIP4361AuthProvider(
      web3Provider,
      web3Provider.getSigner(),
    );
    conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

    // The TACo network will automatically verify the condition by calling
    // shouldDossierStayEncrypted on the Dossier contract
    const decryptedMessage = await decrypt(
      web3Provider,
      TACO_DOMAIN,
      messageKit,
      conditionContext,
    );

    console.log('✅ Decryption successful - Dossier contract confirmed check-in missed');
    return decryptedMessage;
  }

  async commitToPinataOnly(encryptionResult: EncryptionResult): Promise<CommitResult> {
    try {
      console.log('🟣 Uploading to Pinata only (Codex disabled)...');
      
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
      description: commitResult.encryptionResult.description || 'Encrypted file with Dossier condition',
      storage_type: commitResult.storageType,
      gateway_url: gatewayUrl,
      gatewayUsed: gatewayUsed,
      created_at: new Date().toISOString(),
      // Enhanced metadata for Dossier integration
      dossier_id: condition.dossierId?.toString(),
      user_address: condition.userAddress,
      contract_address: condition.dossierId ? CANARY_DOSSIER_ADDRESS : undefined,
    };
  }

  private formatConditionText(condition: DeadmanCondition): string {
    if (condition.dossierId && condition.userAddress) {
      return `Dossier #${condition.dossierId.toString()} check-in verification (${condition.duration || 'contract-defined interval'})`;
    }
    
    switch (condition.type) {
      case 'no_activity':
        return `No activity for ${condition.duration || '1 MINUTE'}`;
      case 'no_checkin':
        return `No check-in for ${condition.duration || '1 MINUTE'}`;
      case 'location':
        return `Location outside ${condition.location || 'safe zone'} for ${condition.duration || '1 MINUTE'}`;
      case 'keyword':
        return `Email containing ${condition.keyword || 'KEYWORD'}`;
      default:
        return `Time condition: ${condition.duration || '1 MINUTE'}`;
    }
  }
}

// Export singleton instance
export const tacoService = new TacoService();

/**
 * Enhanced encryption function that integrates with Dossier contract
 */
export async function encryptFileWithDossier(
  file: File,
  condition: DeadmanCondition,
  description: string = '',
  dossierId: bigint,
  userAddress: string
): Promise<EncryptionResult> {
  // Add dossier information to condition
  const enhancedCondition = {
    ...condition,
    dossierId,
    userAddress
  };
  
  return await tacoService.encryptFile(file, enhancedCondition, description);
}

/**
 * Legacy function for backward compatibility
 */
export async function encryptFileWithCondition(
  file: File,
  condition: DeadmanCondition,
  description: string = ''
): Promise<EncryptionResult> {
  return await tacoService.encryptFile(file, condition, description);
}

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
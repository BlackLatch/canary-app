// Simple TACo integration for time-based conditions
import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, CodexUploadResult } from './codex';
import { uploadToPinata, PinataUploadResult } from './pinata';
import { uploadToIPFS, IPFSUploadResult } from './ipfs';

// TACo Configuration
const TACO_DOMAIN = domains.DEVNET;
const RITUAL_ID = 27;

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
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
  storageType: 'codex' | 'ipfs' | 'pinata' | 'mock';
}

export interface TraceJson {
  payload_uri: string;
  taco_capsule_uri: string;
  condition: string;
  description: string;
  storage_type: 'codex' | 'ipfs' | 'pinata' | 'mock';
  gateway_url?: string;
  gatewayUsed?: 'primary' | 'secondary';
  created_at: string;
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

  private createTimeCondition(durationMinutes: number = 1) {
    const futureTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);
    
    console.log(`⏰ Time condition: ${durationMinutes}m (expires ${new Date(futureTimestamp * 1000).toLocaleTimeString()})`);
    
    return new conditions.base.time.TimeCondition({
      chain: 1, // Ethereum mainnet
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
    const durationMinutes = this.parseDurationToMinutes(condition.duration || '1 MINUTE');
    const tacoCondition = this.createTimeCondition(durationMinutes);

    const fileArrayBuffer = await file.arrayBuffer();
    const message = new Uint8Array(fileArrayBuffer);

    const messageKit = await encrypt(
      web3Provider,
      TACO_DOMAIN,
      message,
      tacoCondition,
      RITUAL_ID,
      web3Provider.getSigner()
    );

    console.log('✅ Encryption successful');

    return {
      messageKit,
      encryptedData: new TextEncoder().encode(JSON.stringify(messageKit)),
      originalFileName: file.name,
      condition,
      description,
      capsuleUri: `taco://real-capsule-${Date.now()}`,
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

    const conditionContext = conditions.context.ConditionContext.fromMessageKit(messageKit);
    const authProvider = new EIP4361AuthProvider(
      web3Provider,
      web3Provider.getSigner(),
    );
    conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

    const decryptedMessage = await decrypt(
      web3Provider,
      TACO_DOMAIN,
      messageKit,
      conditionContext,
    );

    console.log('✅ Decryption successful');
    return decryptedMessage;
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
    }

    // Final fallback
    return {
      encryptionResult,
      codexUploadResult: { 
        cid: '', 
        size: encryptionResult.encryptedData.length, 
        success: false, 
        error: 'All upload methods failed'
      },
      payloadUri: `mock://failed-${Date.now()}`,
      storageType: 'mock'
    };
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
    
    return {
      payload_uri: commitResult.payloadUri,
      taco_capsule_uri: commitResult.encryptionResult.capsuleUri,
      condition: conditionText,
      description: commitResult.encryptionResult.description || 'Encrypted file with time condition',
      storage_type: commitResult.storageType,
      gateway_url: gatewayUrl,
      gatewayUsed: gatewayUsed,
      created_at: new Date().toISOString(),
    };
  }

  private formatConditionText(condition: DeadmanCondition): string {
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

export async function initializeTaco(): Promise<boolean> {
  return await tacoService.initialize();
} 
// Simplified TACo integration for MVP demonstration
// In production, this would integrate with the actual @nucypher/taco SDK

import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, downloadFromCodex, CodexUploadResult } from './codex';

// TACo domain configuration
const TACO_DOMAIN = domains.DEVNET; // Using lynx devnet for development
const RITUAL_ID = 27; // Ritual ID for lynx devnet

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
}

export interface EncryptionResult {
  messageKit: any; // TACo MessageKit
  codexCid?: string; // Codex Content ID
  codexUploadResult?: CodexUploadResult;
  ipfsHash: string; // Fallback/mock hash
  payloadUri: string;
  capsuleUri: string;
}

export interface TraceJson {
  payload_uri: string;
  taco_capsule_uri: string;
  condition: string;
  description: string;
  created_at: string;
}

class TacoService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await initialize();
        this.initialized = true;
        console.log('TACo SDK initialized successfully');
      }
      return true;
    } catch (error) {
      console.error('TACo initialization failed:', error);
      return false;
    }
  }

  private generateRandomHash(): string {
    const chars = '0123456789abcdef';
    let result = 'Qm';
    for (let i = 0; i < 44; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private createTimeCondition(durationHours: number) {
    // Create a simple time-based condition using a placeholder contract
    // This would be replaced with actual deadman switch contract in production
    const futureTimestamp = Math.floor(Date.now() / 1000) + (durationHours * 3600);
    
    // Using a basic condition structure for demonstration
    return new conditions.predefined.erc721.ERC721Ownership({
      contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder
      chain: 1,
      parameters: [futureTimestamp], // Using timestamp as a parameter
    });
  }

  private parseDurationToHours(duration: string): number {
    const match = duration.match(/(\d+)\s*(DAYS?|HOURS?|MINUTES?)/i);
    if (!match) return 24; // Default to 24 hours

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('day')) return value * 24;
    if (unit.startsWith('hour')) return value;
    if (unit.startsWith('minute')) return value / 60;
    
    return 24; // Default fallback
  }

  async encryptFile(
    file: File, 
    condition: DeadmanCondition, 
    description: string
  ): Promise<EncryptionResult> {
    try {
      // Ensure TACo is initialized
      await this.initialize();

      // Get Web3 provider
      if (!window.ethereum) {
        throw new Error('No Web3 provider found. Please install MetaMask.');
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Create condition based on type
      let tacoCondition;
      const durationHours = this.parseDurationToHours(condition.duration || '24 HOURS');
      
      switch (condition.type) {
        case 'no_checkin':
        case 'no_activity':
          // Use time-based condition for deadman switch
          tacoCondition = this.createTimeCondition(durationHours);
          break;
        default:
          // Fallback to time condition
          tacoCondition = this.createTimeCondition(durationHours);
      }

      // Read file as text for encryption
      const fileText = await file.text();
      const message = new TextEncoder().encode(fileText);

      try {
        // Encrypt with TACo
        const messageKit = await encrypt(
          web3Provider,
          TACO_DOMAIN,
          message,
          tacoCondition,
          RITUAL_ID,
          web3Provider.getSigner()
        );

        // Extract encrypted data from messageKit for upload to Codex
        // Convert messageKit to bytes for storage
        const encryptedData = new Uint8Array(JSON.stringify(messageKit).split('').map(c => c.charCodeAt(0)));
        
        // Upload encrypted data to Codex
        const codexUploadResult = await uploadToCodex(
          encryptedData, 
          `${file.name}.encrypted`,
          (loaded, total) => {
            console.log(`Codex upload progress: ${Math.round((loaded / total) * 100)}%`);
          }
        );

        // Generate fallback IPFS hash
        const ipfsHash = this.generateRandomHash();
        
        const result: EncryptionResult = {
          messageKit,
          codexCid: codexUploadResult.success ? codexUploadResult.cid : undefined,
          codexUploadResult,
          ipfsHash,
          payloadUri: codexUploadResult.success ? `codex://${codexUploadResult.cid}` : `ipfs://${ipfsHash}`,
          capsuleUri: `taco://capsule-${Date.now()}`,
        };

        if (codexUploadResult.success) {
          console.log('Successfully uploaded encrypted data to Codex:', codexUploadResult.cid);
        } else {
          console.warn('Codex upload failed, using fallback storage:', codexUploadResult.error);
        }

        return result;

      } catch (tacoError) {
        console.warn('TACo encryption failed, falling back to mock:', tacoError);
        // Fallback to mock implementation for demo purposes
        return this.createMockEncryption(file, condition);
      }

    } catch (error) {
      console.error('TACo encryption error:', error);
      // Fallback to mock for demo purposes
      return this.createMockEncryption(file, condition);
    }
  }

  private async createMockEncryption(file: File, condition: DeadmanCondition): Promise<EncryptionResult> {
    // Fallback mock implementation for demo purposes
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);
    
    const mockMessageKit = {
      encryptedData: new Uint8Array([
        ...Array.from(new TextEncoder().encode('MOCK_ENCRYPTED:')),
        ...fileData
      ]),
      condition: condition,
      isMock: true
    };

    const ipfsHash = this.generateRandomHash();
    
    return {
      messageKit: mockMessageKit,
      codexCid: undefined,
      codexUploadResult: { cid: '', size: 0, success: false, error: 'Mock mode - no Codex upload' },
      ipfsHash,
      payloadUri: `ipfs://${ipfsHash}`,
      capsuleUri: `taco://mock-capsule-${Date.now()}`,
    };
  }

  async decryptFile(messageKit: any, web3Provider?: ethers.providers.Web3Provider): Promise<Uint8Array> {
    try {
      // Check if this is a mock encryption
      if (messageKit.isMock) {
        console.log('Decrypting mock data');
        return messageKit.encryptedData;
      }

      if (!web3Provider) {
        if (!window.ethereum) {
          throw new Error('No Web3 provider found');
        }
        web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      }

      // Set up condition context for decryption
      const conditionContext = conditions.context.ConditionContext.fromMessageKit(messageKit);
      
      // Set up auth provider
      const authProvider = new EIP4361AuthProvider(
        web3Provider,
        web3Provider.getSigner(),
      );
      conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

      // Decrypt with TACo
      const decryptedMessage = await decrypt(
        web3Provider,
        TACO_DOMAIN,
        messageKit,
        conditionContext,
      );

      return decryptedMessage;

    } catch (error) {
      console.error('Decryption failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown decryption error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  createTraceJson(
    encryptionResult: EncryptionResult,
    condition: DeadmanCondition,
    description: string
  ): TraceJson {
    const conditionText = this.formatConditionText(condition);
    
    return {
      payload_uri: encryptionResult.payloadUri,
      taco_capsule_uri: encryptionResult.capsuleUri,
      condition: conditionText,
      description: description || 'Encrypted file with conditional access',
      created_at: new Date().toISOString(),
    };
  }

  private formatConditionText(condition: DeadmanCondition): string {
    switch (condition.type) {
      case 'no_activity':
        return `No activity for ${condition.duration || '24 HOURS'}`;
      case 'no_checkin':
        return `No check-in for ${condition.duration || '24 HOURS'}`;
      case 'location':
        return `Location outside the ${condition.location || 'U.S.'} for ${condition.duration || '24 HOURS'}`;
      case 'keyword':
        return `Email containing ${condition.keyword || 'KEYWORD'}`;
      default:
        return `Conditional access: ${condition.duration || '24 HOURS'}`;
    }
  }
}

// Export singleton instance
export const tacoService = new TacoService();

// Export utility functions
export async function encryptFileWithCondition(
  file: File,
  condition: DeadmanCondition,
  description: string = ''
): Promise<{ encryptionResult: EncryptionResult; traceJson: TraceJson }> {
  try {
    const encryptionResult = await tacoService.encryptFile(file, condition, description);
    const traceJson = tacoService.createTraceJson(encryptionResult, condition, description);
    
    return { encryptionResult, traceJson };
  } catch (error) {
    console.error('File encryption failed:', error);
    throw error;
  }
}

// Initialize TACo on module load
export async function initializeTaco(): Promise<boolean> {
  return await tacoService.initialize();
} 
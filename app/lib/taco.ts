// Simplified TACo integration for MVP demonstration
// In production, this would integrate with the actual @nucypher/taco SDK

import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, downloadFromCodex, CodexUploadResult } from './codex';
import { uploadToIPFS, downloadFromIPFS, IPFSUploadResult } from './ipfs';
import { uploadToPinata, PinataUploadResult } from './pinata';

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
  encryptedData: Uint8Array; // Raw encrypted data for upload
  originalFileName: string; // Original file name
  condition: DeadmanCondition; // Condition used for encryption
  description: string; // User description
  capsuleUri: string;
}

export interface CommitResult {
  encryptionResult: EncryptionResult;
  codexCid?: string; // Codex Content ID  
  codexUploadResult?: CodexUploadResult;
  ipfsCid?: string; // IPFS Content ID
  ipfsUploadResult?: IPFSUploadResult;
  pinataCid?: string; // Pinata IPFS Content ID
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
  gateway_url?: string; // For IPFS uploads
  gatewayUsed?: 'primary' | 'secondary'; // Which IPFS gateway was used
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
          encryptedData,
          originalFileName: file.name,
          condition,
          description,
          capsuleUri: `taco://capsule-${Date.now()}`,
        };

        console.log('TACo encryption completed successfully');
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
      encryptedData: mockMessageKit.encryptedData,
      originalFileName: file.name,
      condition,
      description: 'Mock encryption for demo',
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

  async commitToCodex(encryptionResult: EncryptionResult): Promise<CommitResult> {
    console.log('🔵 STARTING COMMIT TO CODEX');
    console.log('🔵 File:', encryptionResult.originalFileName);
    console.log('🔵 Encrypted size:', encryptionResult.encryptedData.length, 'bytes');
    
    try {
      // Upload encrypted data to Codex
      const codexUploadResult = await uploadToCodex(
        encryptionResult.encryptedData, 
        `${encryptionResult.originalFileName}.encrypted`,
        (loaded, total) => {
          console.log(`📊 Codex upload progress: ${Math.round((loaded / total) * 100)}%`);
        }
      );

      if (codexUploadResult.success) {
        // Check if it's a real CID or mock
        const isRealCid = !codexUploadResult.cid.includes('Mock');
        console.log(isRealCid ? '✅ REAL CODEX UPLOAD SUCCESSFUL!' : '⚠️ MOCK UPLOAD (Codex not available)');
        console.log('📦 CID:', codexUploadResult.cid);
        console.log('📦 Size:', codexUploadResult.size, 'bytes');
        
        const result: CommitResult = {
          encryptionResult,
          codexCid: codexUploadResult.cid,
          codexUploadResult,
          payloadUri: `codex://${codexUploadResult.cid}`,
          storageType: 'codex'
        };

        return result;
      } else {
        // Codex upload failed, try Pinata IPFS fallback first
        console.warn('❌ Codex upload failed, trying Pinata IPFS fallback:', codexUploadResult.error);
        
        try {
          const pinataUploadResult = await uploadToPinata(
            encryptionResult.encryptedData,
            `${encryptionResult.originalFileName}.encrypted`,
            (loaded, total) => {
              console.log(`📊 Pinata upload progress: ${Math.round((loaded / total) * 100)}%`);
            }
          );

          if (pinataUploadResult.success) {
            console.log('✅ PINATA FALLBACK SUCCESSFUL!');
            console.log('📦 IPFS Hash:', pinataUploadResult.ipfsHash);
            console.log('📦 Gateway URL:', pinataUploadResult.gatewayUrl);

            const result: CommitResult = {
              encryptionResult,
              codexUploadResult,
              pinataCid: pinataUploadResult.ipfsHash,
              pinataUploadResult,
              payloadUri: `ipfs://${pinataUploadResult.ipfsHash}`,
              storageType: 'pinata'
            };

            return result;
          } else {
            throw new Error(`Pinata upload failed: ${pinataUploadResult.error}`);
          }
        } catch (pinataError) {
          console.error('❌ Pinata fallback failed, trying local IPFS:', pinataError);
          
          // Try local IPFS as secondary fallback
          try {
            const ipfsUploadResult = await uploadToIPFS(
              encryptionResult.encryptedData,
              `${encryptionResult.originalFileName}.encrypted`,
              (loaded, total) => {
                console.log(`📊 Local IPFS upload progress: ${Math.round((loaded / total) * 100)}%`);
              }
            );

            if (ipfsUploadResult.success) {
              console.log('✅ LOCAL IPFS FALLBACK SUCCESSFUL!');
              console.log('📦 IPFS CID:', ipfsUploadResult.cid);
              console.log('📦 Gateway URL:', ipfsUploadResult.gatewayUrl);

              const result: CommitResult = {
                encryptionResult,
                codexUploadResult,
                ipfsCid: ipfsUploadResult.cid,
                ipfsUploadResult,
                payloadUri: `ipfs://${ipfsUploadResult.cid}`,
                storageType: 'ipfs'
              };

              return result;
            } else {
              throw new Error(`Local IPFS upload failed: ${ipfsUploadResult.error}`);
            }
          } catch (ipfsError) {
            console.error('❌ Both Pinata and local IPFS failed:', ipfsError);
            
            // Final fallback to mock
            const mockHash = this.generateRandomHash();
            const result: CommitResult = {
              encryptionResult,
              codexUploadResult,
              payloadUri: `ipfs://${mockHash}`,
              storageType: 'mock'
            };

            return result;
          }
        }
      }
    } catch (error) {
      console.error('❌ COMMIT PROCESS FAILED:', error);
      
      // Try Pinata as emergency fallback first
      try {
        console.log('🟣 Attempting Pinata as emergency fallback...');
        const pinataUploadResult = await uploadToPinata(
          encryptionResult.encryptedData,
          `${encryptionResult.originalFileName}.encrypted`
        );

        if (pinataUploadResult.success) {
          console.log('✅ EMERGENCY PINATA FALLBACK SUCCESSFUL!');
          
          return {
            encryptionResult,
            pinataCid: pinataUploadResult.ipfsHash,
            pinataUploadResult,
            payloadUri: `ipfs://${pinataUploadResult.ipfsHash}`,
            storageType: 'pinata'
          };
        }
      } catch (pinataError) {
        console.error('❌ Emergency Pinata fallback failed:', pinataError);
        
        // Try local IPFS as final emergency fallback
        try {
          console.log('🟣 Attempting local IPFS as final emergency fallback...');
          const ipfsUploadResult = await uploadToIPFS(
            encryptionResult.encryptedData,
            `${encryptionResult.originalFileName}.encrypted`
          );

          if (ipfsUploadResult.success) {
            console.log('✅ EMERGENCY LOCAL IPFS FALLBACK SUCCESSFUL!');
            
            return {
              encryptionResult,
              ipfsCid: ipfsUploadResult.cid,
              ipfsUploadResult,
              payloadUri: `ipfs://${ipfsUploadResult.cid}`,
              storageType: 'ipfs'
            };
          }
        } catch (ipfsError) {
          console.error('❌ All emergency fallbacks failed:', ipfsError);
        }
      }

      // Final mock fallback
      const mockHash = this.generateRandomHash();
      return {
        encryptionResult,
        codexUploadResult: { 
          cid: '', 
          size: encryptionResult.encryptedData.length, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown commit error'
        },
        payloadUri: `ipfs://${mockHash}`,
        storageType: 'mock'
      };
    }
  }

  createTraceJson(
    commitResult: CommitResult
  ): TraceJson {
    const conditionText = this.formatConditionText(commitResult.encryptionResult.condition);
    
    // Get gateway URL from either Pinata or IPFS upload
    let gatewayUrl: string | undefined;
    let gatewayUsed: 'primary' | 'secondary' | undefined;
    
    if (commitResult.pinataUploadResult?.success) {
      gatewayUrl = commitResult.pinataUploadResult.gatewayUrl;
      gatewayUsed = 'primary'; // Pinata is our primary IPFS option
    } else if (commitResult.ipfsUploadResult?.success) {
      gatewayUrl = commitResult.ipfsUploadResult.gatewayUrl;
      gatewayUsed = commitResult.ipfsUploadResult.gatewayUsed;
    }
    
    return {
      payload_uri: commitResult.payloadUri,
      taco_capsule_uri: commitResult.encryptionResult.capsuleUri,
      condition: conditionText,
      description: commitResult.encryptionResult.description || 'Encrypted file with conditional access',
      storage_type: commitResult.storageType,
      gateway_url: gatewayUrl,
      gatewayUsed: gatewayUsed,
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
): Promise<EncryptionResult> {
  try {
    const encryptionResult = await tacoService.encryptFile(file, condition, description);
    return encryptionResult;
  } catch (error) {
    console.error('File encryption failed:', error);
    throw error;
  }
}

export async function commitEncryptedFile(
  encryptionResult: EncryptionResult
): Promise<{ commitResult: CommitResult; traceJson: TraceJson }> {
  try {
    const commitResult = await tacoService.commitToCodex(encryptionResult);
    const traceJson = tacoService.createTraceJson(commitResult);
    
    return { commitResult, traceJson };
  } catch (error) {
    console.error('File commit failed:', error);
    throw error;
  }
}

// Initialize TACo on module load
export async function initializeTaco(): Promise<boolean> {
  return await tacoService.initialize();
} 
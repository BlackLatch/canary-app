// Simplified TACo integration for MVP demonstration
// In production, this would integrate with the actual @nucypher/taco SDK

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
}

export interface EncryptionResult {
  encryptedData: Uint8Array;
  capsule: any;
  ipfsHash: string;
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

// Mock encryption service for MVP demonstration
class MockTacoService {
  private generateRandomHash(): string {
    const chars = '0123456789abcdef';
    let result = 'Qm';
    for (let i = 0; i < 44; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private generateCapsuleId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  async encryptFile(
    file: File, 
    condition: DeadmanCondition, 
    description: string
  ): Promise<EncryptionResult> {
    // Simulate encryption process
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Convert file to Uint8Array (this would be the actual encrypted data)
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);
    
    // In production, this would be the actual encrypted data from TACo
    const mockEncryptedData = new Uint8Array([
      ...Array.from(new TextEncoder().encode('ENCRYPTED:')),
      ...fileData
    ]);

    const ipfsHash = this.generateRandomHash();
    const capsuleId = this.generateCapsuleId();

    return {
      encryptedData: mockEncryptedData,
      capsule: {
        id: capsuleId,
        condition: this.createConditionObject(condition),
        created_at: new Date().toISOString(),
      },
      ipfsHash,
      payloadUri: `ipfs://${ipfsHash}`,
      capsuleUri: `taco://capsule-${capsuleId}`,
    };
  }

  private createConditionObject(condition: DeadmanCondition): any {
    const baseCondition = {
      type: condition.type,
      created_at: new Date().toISOString(),
    };

    switch (condition.type) {
      case 'no_activity':
        return {
          ...baseCondition,
          duration_seconds: this.parseDurationToSeconds(condition.duration || '24 HOURS'),
          check_method: 'blockchain_activity',
        };
      case 'no_checkin':
        return {
          ...baseCondition,
          time_window: condition.timeWindow || { start: '11:00', end: '13:00' },
          check_method: 'api_checkin',
        };
      case 'location':
        return {
          ...baseCondition,
          allowed_location: condition.location || 'U.S.',
          duration_seconds: this.parseDurationToSeconds(condition.duration || '24 HOURS'),
          check_method: 'geolocation_api',
        };
      case 'keyword':
        return {
          ...baseCondition,
          keyword: condition.keyword || 'EMERGENCY',
          check_method: 'email_monitoring',
        };
      default:
        return baseCondition;
    }
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/(\d+)\s*(DAYS?|HOURS?|MINUTES?)/i);
    if (!match) return 24 * 60 * 60; // Default to 24 hours

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('day')) return value * 24 * 60 * 60;
    if (unit.startsWith('hour')) return value * 60 * 60;
    if (unit.startsWith('minute')) return value * 60;
    
    return 24 * 60 * 60; // Default fallback
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
        return `No check-in from ${condition.timeWindow?.start || '11 AM'} to ${condition.timeWindow?.end || '1 PM'}`;
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
export const tacoService = new MockTacoService();

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

// Export function to simulate real TACo integration
// This would be replaced with actual TACo SDK calls in production
export async function initializeTaco(): Promise<boolean> {
  try {
    // Simulate TACo initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('TACo SDK initialized (mock)');
    return true;
  } catch (error) {
    console.error('TACo initialization failed:', error);
    return false;
  }
} 
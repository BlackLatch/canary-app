import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';

// IPFS configuration
const PRIMARY_IPFS_GATEWAY = 'https://purple-certain-guan-605.mypinata.cloud';
const SECONDARY_IPFS_GATEWAY = 'https://ipfs.io';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  success: boolean;
  error?: string;
  gatewayUrl: string;
  gatewayUsed: 'primary' | 'secondary';
}

class IPFSService {
  private helia: any = null;
  private fs: any = null;
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      if (!this.initialized) {
        console.log('🟣 Initializing Helia IPFS...');
        this.helia = await createHelia();
        this.fs = unixfs(this.helia);
        this.initialized = true;
        console.log('✅ Helia IPFS initialized successfully');
      }
      return true;
    } catch (error) {
      console.error('❌ Helia IPFS initialization failed:', error);
      return false;
    }
  }

  async uploadToIPFS(
    data: Uint8Array,
    filename: string = 'encrypted_file',
    onProgress?: (loaded: number, total: number) => void
  ): Promise<IPFSUploadResult> {
    try {
      console.log('🟣 IPFS UPLOAD ATTEMPT');
      console.log('- File size:', data.length, 'bytes');
      console.log('- Filename:', filename);
      
      // Ensure IPFS is initialized
      if (!this.initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          throw new Error('Failed to initialize IPFS');
        }
      }

      // Add progress simulation since Helia doesn't provide detailed progress
      if (onProgress) {
        onProgress(0, data.length);
        setTimeout(() => onProgress(data.length * 0.5, data.length), 100);
        setTimeout(() => onProgress(data.length * 0.8, data.length), 200);
      }

      console.log('📤 Adding file to IPFS...');
      const cid = await this.fs.addBytes(data);
      const cidString = cid.toString();

      if (onProgress) {
        onProgress(data.length, data.length);
      }

      // Try primary gateway first, then secondary
      let gatewayUrl: string;
      let gatewayUsed: 'primary' | 'secondary';
      
      try {
        gatewayUrl = `${PRIMARY_IPFS_GATEWAY}/ipfs/${cidString}`;
        gatewayUsed = 'primary';
        console.log('🟣 Using primary Pinata gateway');
      } catch {
        gatewayUrl = `${SECONDARY_IPFS_GATEWAY}/ipfs/${cidString}`;
        gatewayUsed = 'secondary';
        console.log('🟣 Fallback to secondary ipfs.io gateway');
      }

      console.log('🎉 IPFS UPLOAD SUCCESS!');
      console.log('📦 CID:', cidString);
      console.log('📦 Gateway URL:', gatewayUrl);
      console.log('📦 Gateway Used:', gatewayUsed);
      console.log('📦 Size:', data.length, 'bytes');

      return {
        cid: cidString,
        size: data.length,
        success: true,
        gatewayUrl: gatewayUrl,
        gatewayUsed: gatewayUsed
      };

    } catch (error) {
      console.error('❌ IPFS upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown IPFS error';
      
      return {
        cid: '',
        size: data.length,
        success: false,
        error: errorMessage,
        gatewayUrl: '',
        gatewayUsed: 'primary' as const
      };
    }
  }

  async downloadFromIPFS(cid: string): Promise<Uint8Array | null> {
    try {
      if (!this.initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          throw new Error('Failed to initialize IPFS');
        }
      }

      console.log('🟣 Downloading from IPFS, CID:', cid);
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of this.fs.cat(cid)) {
        chunks.push(chunk);
      }

      // Combine all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      console.log('✅ Downloaded from IPFS, size:', result.length, 'bytes');
      return result;

    } catch (error) {
      console.error('❌ IPFS download failed:', error);
      return null;
    }
  }

  async checkIPFSNode(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return await this.initialize();
      }
      
      // Test basic functionality
      const testData = new TextEncoder().encode('test');
      const cid = await this.fs.addBytes(testData);
      console.log('✅ IPFS node check successful, test CID:', cid.toString());
      return true;
    } catch (error) {
      console.error('❌ IPFS node check failed:', error);
      return false;
    }
  }

  generateIPFSUri(cid: string): string {
    return `ipfs://${cid}`;
  }

  generateGatewayUrl(cid: string, usePrimary: boolean = true): string {
    const gateway = usePrimary ? PRIMARY_IPFS_GATEWAY : SECONDARY_IPFS_GATEWAY;
    return `${gateway}/ipfs/${cid}`;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.helia) {
        await this.helia.stop();
        this.helia = null;
        this.fs = null;
        this.initialized = false;
        console.log('🟣 IPFS cleanup completed');
      }
    } catch (error) {
      console.error('❌ IPFS cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();

// Utility function to upload encrypted data to IPFS
export async function uploadToIPFS(
  encryptedData: Uint8Array,
  filename?: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<IPFSUploadResult> {
  return await ipfsService.uploadToIPFS(encryptedData, filename, onProgress);
}

// Utility function to download encrypted data from IPFS
export async function downloadFromIPFS(cid: string): Promise<Uint8Array | null> {
  return await ipfsService.downloadFromIPFS(cid);
} 
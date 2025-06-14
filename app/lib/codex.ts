import { Codex } from '@codex-storage/sdk-js';

// Try to import upload strategies - they might be separate exports
let BrowserUploadStrategy: any = null;
let NodeUploadStrategy: any = null;

try {
  const strategies = require('@codex-storage/sdk-js');
  BrowserUploadStrategy = strategies.BrowserUploadStrategy;
  NodeUploadStrategy = strategies.NodeUploadStrategy;
  console.log('🔍 Upload strategies available:', { 
    BrowserUploadStrategy: !!BrowserUploadStrategy, 
    NodeUploadStrategy: !!NodeUploadStrategy 
  });
} catch (e) {
  console.log('🔍 Could not import upload strategies:', e instanceof Error ? e.message : String(e));
}

// Debug: Let's see what's available in the SDK
console.log('🔍 Codex SDK import:', { Codex });
console.log('🔍 Codex prototype:', Object.getOwnPropertyNames(Codex.prototype));

// Codex node configuration
const CODEX_NODE_URL = process.env.NEXT_PUBLIC_CODEX_NODE_URL || 'http://localhost:8080';

export interface CodexUploadResult {
  cid: string;
  size: number;
  success: boolean;
  error?: string;
}

class CodexService {
  private codex: Codex;
  private data: any;

  constructor() {
    this.codex = new Codex(CODEX_NODE_URL);
  }

  async initialize(): Promise<boolean> {
    try {
      // Access the data module (it's a getter property)
      this.data = this.codex.data;
      
      // Test if the data module exists and log its properties
      console.log('Codex data module:', this.data);
      console.log('Available methods:', Object.getOwnPropertyNames(this.data));
      
      if (!this.data) {
        throw new Error('Codex data module not available');
      }
      
      console.log('Codex service initialized successfully');
      return true;
    } catch (error) {
      console.error('Codex initialization failed:', error);
      return false;
    }
  }

  async uploadCiphertext(
    encryptedData: Uint8Array, 
    filename: string = 'encrypted_file',
    onProgress?: (loaded: number, total: number) => void
  ): Promise<CodexUploadResult> {
    try {
      // Ensure Codex is initialized
      if (!this.data) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Codex service');
        }
      }

      // Convert Uint8Array to Blob for browser upload
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const file = new File([blob], filename, { type: 'application/octet-stream' });

      // Set up progress callback
      const progressCallback = onProgress || ((loaded: number, total: number) => {
        console.log(`Upload progress: ${Math.round((loaded / total) * 100)}%`);
      });

      // Create metadata
      const metadata = {
        filename: filename,
        mimetype: 'application/octet-stream'
      };

      // Upload to Codex network using the data module
      console.log('🚀 LOCAL CODEX UPLOAD ATTEMPT');
      console.log('📍 Target node:', CODEX_NODE_URL);
      console.log('- File size:', encryptedData.length, 'bytes');
      console.log('- Filename:', filename);
      console.log('- Upload method exists:', typeof this.data.upload === 'function');
      console.log('- Data module:', this.data);
      
      // Check if we can connect to Codex node first
      try {
        const spaceInfo = await this.data.space();
        console.log('✅ LOCAL CODEX NODE CONNECTION SUCCESSFUL!');
        console.log('📍 Node URL:', CODEX_NODE_URL);
        console.log('💾 Space info:', spaceInfo);
      } catch (connectionError) {
        console.error('❌ LOCAL CODEX NODE CONNECTION FAILED:', connectionError);
        console.error('📍 Attempted connection to:', CODEX_NODE_URL);
        throw new Error(`Cannot connect to local Codex node at ${CODEX_NODE_URL}`);
      }
      
      // Try the actual upload using different methods
      console.log('📤 Starting Codex upload...');
      console.log('📤 Available data methods:', Object.getOwnPropertyNames(this.data));
      console.log('📤 Data object prototype:', Object.getPrototypeOf(this.data));
      console.log('📤 Data constructor:', this.data.constructor.name);
      
      let uploadResponse;
      try {
        // Try different possible upload methods
        if (typeof this.data.uploadFile === 'function') {
          console.log('📤 Using uploadFile method');
          uploadResponse = await this.data.uploadFile(file);
        } else if (typeof this.data.putData === 'function') {
          console.log('📤 Using putData method');
          uploadResponse = await this.data.putData(encryptedData, metadata);
        } else if (typeof this.data.upload === 'function') {
          console.log('📤 Attempting upload with strategy');
          
          // Try to use upload strategies
          if (BrowserUploadStrategy) {
            console.log('📤 Using BrowserUploadStrategy');
            const strategy = new BrowserUploadStrategy(file, progressCallback, metadata);
            const uploadPromise = this.data.upload(strategy);
            uploadResponse = await uploadPromise.result;
          } else if (NodeUploadStrategy) {
            console.log('📤 Using NodeUploadStrategy');
            // Convert file to buffer for Node strategy
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            const strategy = new NodeUploadStrategy(buffer);
            const uploadPromise = this.data.upload(strategy);
            uploadResponse = await uploadPromise.result;
          } else {
            console.log('📤 No upload strategies available, trying direct REST API');
            throw new Error('No upload strategies available');
          }
        } else {
          throw new Error('No upload method found on data object');
        }
        
        // If we reach here but upload failed, try REST API fallback
        if (!uploadResponse || (uploadResponse.error && uploadResponse.error === true)) {
          console.log('📤 SDK upload failed, trying REST API fallback');
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch(`${CODEX_NODE_URL}/api/codex/v1/data`, {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`REST API upload failed: ${response.status} ${response.statusText}`);
          }
          
          const responseText = await response.text();
          console.log('📤 REST API response:', responseText);
          uploadResponse = responseText; // Should be the CID
        }
        
        console.log('📤 Raw upload response:', uploadResponse);
        console.log('📤 Response type:', typeof uploadResponse);
      } catch (uploadError) {
        console.error('❌ CODEX UPLOAD FAILED:', uploadError);
        const errorDetails = uploadError instanceof Error ? {
          message: uploadError.message,
          stack: uploadError.stack,
          name: uploadError.name
        } : { message: String(uploadError) };
        console.error('❌ Error details:', errorDetails);
        throw uploadError; // Don't fallback to mock, let it fail properly
      }
      
      // Handle different response formats
      let cid: string;
      if (typeof uploadResponse === 'string') {
        console.log('✅ Got string CID:', uploadResponse);
        cid = uploadResponse;
      } else if (uploadResponse && uploadResponse.data) {
        console.log('✅ Got CID from response.data:', uploadResponse.data);
        cid = uploadResponse.data;
      } else if (uploadResponse && uploadResponse.cid) {
        console.log('✅ Got CID from response.cid:', uploadResponse.cid);
        cid = uploadResponse.cid;
      } else {
        console.error('❌ Unexpected response format:', uploadResponse);
        throw new Error('Invalid response format from Codex upload');
      }

      // Validate the CID format
      if (!cid || typeof cid !== 'string') {
        throw new Error('Invalid CID received from Codex');
      }

      console.log('🎉 LOCAL CODEX UPLOAD SUCCESS!');
      console.log('🎉 CID:', cid);
      console.log('🎉 Size:', encryptedData.length, 'bytes');
      console.log('📍 Stored on local node:', CODEX_NODE_URL);
      
      return {
        cid: cid,
        size: encryptedData.length,
        success: true
      };

    } catch (error) {
      console.error('Codex upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      
      return {
        cid: '',
        size: encryptedData.length,
        success: false,
        error: errorMessage
      };
    }
  }

  async downloadCiphertext(cid: string): Promise<Uint8Array | null> {
    try {
      if (!this.data) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Codex service');
        }
      }

      // Download from Codex network
      const response = await this.data.networkDownloadStream(cid);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      // Convert response to Uint8Array
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);

    } catch (error) {
      console.error('Codex download error:', error);
      return null;
    }
  }

  async checkNodeConnection(): Promise<boolean> {
    try {
      if (!this.data) {
        return await this.initialize();
      }
      
      // Try to get node space info to check connection
      const space = await this.data.space();
      return space !== null;
    } catch (error) {
      console.error('Codex node connection check failed:', error);
      return false;
    }
  }

  generateCodexUri(cid: string): string {
    return `codex://${cid}`;
  }
}

// Export singleton instance
export const codexService = new CodexService();

// Utility function to upload encrypted data to Codex
export async function uploadToCodex(
  encryptedData: Uint8Array,
  filename?: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<CodexUploadResult> {
  return await codexService.uploadCiphertext(encryptedData, filename, onProgress);
}

// Utility function to download encrypted data from Codex
export async function downloadFromCodex(cid: string): Promise<Uint8Array | null> {
  return await codexService.downloadCiphertext(cid);
} 
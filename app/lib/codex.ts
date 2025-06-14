import { Codex } from '@codex-storage/sdk-js';

// For now, we'll use direct REST API calls since SDK strategies are not working
console.log('🔍 Using direct REST API approach for local Codex node');

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
        // Skip SDK methods and go directly to REST API for local Codex node
        console.log('📤 Using direct REST API to local Codex node');
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${CODEX_NODE_URL}/api/codex/v1/data`, {
          method: 'POST',
          body: formData,
          headers: {
            // Don't set Content-Type, let browser set it with boundary for FormData
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('📤 REST API error response:', errorText);
          throw new Error(`REST API upload failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('📤 REST API response:', responseText);
        uploadResponse = responseText.trim(); // Should be the CID
        
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
        
        // Try REST API as final fallback
        try {
          console.log('📤 Attempting final REST API fallback');
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
          console.log('📤 Final REST API fallback success:', responseText);
          uploadResponse = responseText;
        } catch (restError) {
          console.error('❌ REST API fallback also failed:', restError);
          throw uploadError; // Throw original error
        }
      }
      
      // Handle REST API response (should be just the CID string)
      let cid: string;
      if (typeof uploadResponse === 'string' && uploadResponse.length > 0) {
        console.log('✅ Got CID from REST API:', uploadResponse);
        cid = uploadResponse;
      } else {
        console.error('❌ Invalid REST API response format:', uploadResponse);
        throw new Error('Invalid CID received from Codex REST API');
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
      console.log('📥 LOCAL CODEX DOWNLOAD ATTEMPT');
      console.log('📍 Target node:', CODEX_NODE_URL);
      console.log('📦 CID:', cid);

      if (!this.data) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Codex service');
        }
      }

      // Check connection first
      try {
        const spaceInfo = await this.data.space();
        console.log('✅ LOCAL CODEX NODE CONNECTION OK FOR DOWNLOAD');
        console.log('💾 Space info:', spaceInfo);
      } catch (connectionError) {
        console.error('❌ LOCAL CODEX NODE CONNECTION FAILED:', connectionError);
        throw new Error(`Cannot connect to local Codex node at ${CODEX_NODE_URL}`);
      }

      console.log('📥 Available download methods:', Object.getOwnPropertyNames(this.data));
      
      // Go directly to REST API for downloads from local Codex node
      try {
        console.log('📥 Using direct REST API to download from local Codex node');
        const restResponse = await fetch(`${CODEX_NODE_URL}/api/codex/v1/data/${cid}`, {
          method: 'GET',
        });

        if (!restResponse.ok) {
          const errorText = await restResponse.text();
          console.error('📥 REST API download error:', errorText);
          throw new Error(`REST API download failed: ${restResponse.status} ${restResponse.statusText} - ${errorText}`);
        }

        const arrayBuffer = await restResponse.arrayBuffer();
        const result = new Uint8Array(arrayBuffer);
        
        console.log('🎉 LOCAL CODEX DOWNLOAD SUCCESS!');
        console.log('📦 Downloaded size:', result.length, 'bytes');
        console.log('📍 From local node via REST:', CODEX_NODE_URL);
        
        return result;

      } catch (restError) {
        console.error('❌ REST API download failed:', restError);
        
        // Try SDK methods as fallback
        try {
          console.log('📥 Attempting SDK fallback methods...');
          
          let response: Response | null = null;
          
          // Try different download methods
          if (typeof this.data.networkDownloadStream === 'function') {
            console.log('📥 Using networkDownloadStream method');
            response = await this.data.networkDownloadStream(cid);
          } 
          else if (typeof this.data.localDownload === 'function') {
            console.log('📥 Using localDownload method');
            response = await this.data.localDownload(cid);
          }
          else if (typeof this.data.download === 'function') {
            console.log('📥 Using generic download method');
            response = await this.data.download(cid);
          } 
          else {
            throw new Error('No download method found on data object');
          }

          if (!response || !response.ok) {
            throw new Error(`SDK download failed with status: ${response?.status || 'unknown'}`);
          }

          console.log('✅ SDK fallback download successful');
          const arrayBuffer = await response.arrayBuffer();
          const result = new Uint8Array(arrayBuffer);
          
          console.log('🎉 LOCAL CODEX SDK FALLBACK SUCCESS!');
          console.log('📦 Downloaded size:', result.length, 'bytes');
          
          return result;

        } catch (sdkError) {
          console.error('❌ SDK fallback also failed:', sdkError);
          throw restError; // Throw original REST error
        }
      }

    } catch (error) {
      console.error('❌ LOCAL CODEX DOWNLOAD FAILED:', error);
      const errorDetails = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : { message: String(error) };
      console.error('❌ Download error details:', errorDetails);
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

  // Helper method to save downloaded data as a file
  async downloadAndSave(cid: string, filename?: string): Promise<boolean> {
    try {
      console.log('💾 Downloading and saving file:', cid);
      
      const data = await this.downloadCiphertext(cid);
      if (!data) {
        throw new Error('Failed to download file data');
      }

      // Create blob and download URL
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `codex-file-${cid.substring(0, 8)}.bin`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL
      URL.revokeObjectURL(url);

      console.log('✅ File saved successfully:', link.download);
      return true;

    } catch (error) {
      console.error('❌ Download and save failed:', error);
      return false;
    }
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

// Utility function to download and save encrypted data as a file
export async function downloadAndSaveFromCodex(cid: string, filename?: string): Promise<boolean> {
  return await codexService.downloadAndSave(cid, filename);
}
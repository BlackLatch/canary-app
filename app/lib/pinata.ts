// Pinata IPFS Pinning Service
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://purple-certain-guan-605.mypinata.cloud';

export interface PinataUploadResult {
  ipfsHash: string;
  pinSize: number;
  timestamp: string;
  success: boolean;
  error?: string;
  gatewayUrl: string;
}

class PinataService {
  private apiKey: string;
  private apiSecret: string;
  private jwt: string;

  constructor() {
    // Try to get credentials from environment
    this.apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || '69f2807bf8c79d48899a';
    this.apiSecret = process.env.NEXT_PUBLIC_PINATA_API_SECRET || '2f0b396b6ba151bda7339199b1b9c94b8d038a6177cc94820582d95e821e8d8e';
    this.jwt = process.env.NEXT_PUBLIC_PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIzZjNlODA4MC04Y2Q5LTQxNDMtOThiMS0zMDhjNzgzOTg4OWMiLCJlbWFpbCI6ImtpZXJhbnByYXNjaEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNjlmMjgwN2JmOGM3OWQ0ODg5OWEiLCJzY29wZWRLZXlTZWNyZXQiOiIyZjBiMzk2YjZiYTE1MWJkYTczMzkxOTliMWI5Yzk0YjhkMDM4YTYxNzdjYzk0ODIwNTgyZDk1ZTgyMWU4ZDhlIiwiZXhwIjoxNzgxNDU3Njc1fQ.BO5bFwE70d_lT_hHPwwQmu7FSvnFHO31qO9i0dST_Bs';
    
    console.log('🟣 Pinata service initialized');
    console.log('📍 API Key available:', !!this.apiKey);
    console.log('📍 JWT available:', !!this.jwt);
  }

  async pinFileToIPFS(
    encryptedData: Uint8Array,
    filename: string = 'encrypted_file',
    onProgress?: (loaded: number, total: number) => void
  ): Promise<PinataUploadResult> {
    try {
      console.log('🟣 PINATA UPLOAD ATTEMPT');
      console.log('📍 Target:', PINATA_API_URL);
      console.log('- File size:', encryptedData.length, 'bytes');
      console.log('- Filename:', filename);

      // Check for authentication
      if (!this.jwt && !this.apiKey) {
        throw new Error('No Pinata API credentials found. Please set NEXT_PUBLIC_PINATA_JWT or API keys.');
      }

      // Create FormData
      const formData = new FormData();
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const file = new File([blob], filename, { type: 'application/octet-stream' });
      formData.append('file', file);

      // Add metadata
      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          type: 'encrypted_file',
          timestamp: new Date().toISOString(),
          size: encryptedData.length.toString()
        }
      });
      formData.append('pinataMetadata', metadata);

      // Add options
      const options = JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false
      });
      formData.append('pinataOptions', options);

      // Prepare headers
      const headers: HeadersInit = {};
      if (this.jwt) {
        headers['Authorization'] = `Bearer ${this.jwt}`;
      } else if (this.apiKey && this.apiSecret) {
        headers['pinata_api_key'] = this.apiKey;
        headers['pinata_secret_api_key'] = this.apiSecret;
      }

      console.log('📤 Uploading to Pinata...');
      
      // Create XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Progress tracking
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              onProgress(e.loaded, e.total);
              console.log(`📊 Pinata upload progress: ${Math.round((e.loaded / e.total) * 100)}%`);
            }
          });
        }

        xhr.onload = () => {
          try {
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              const ipfsHash = response.IpfsHash;
              const gatewayUrl = `${PINATA_GATEWAY}/ipfs/${ipfsHash}`;
              
              console.log('🎉 PINATA UPLOAD SUCCESS!');
              console.log('📦 IPFS Hash:', ipfsHash);
              console.log('📦 Pin Size:', response.PinSize);
              console.log('📦 Gateway URL:', gatewayUrl);
              
              resolve({
                ipfsHash: ipfsHash,
                pinSize: response.PinSize,
                timestamp: response.Timestamp,
                success: true,
                gatewayUrl: gatewayUrl
              });
            } else {
              const errorText = xhr.responseText;
              console.error('❌ Pinata upload failed:', xhr.status, errorText);
              reject(new Error(`Pinata upload failed: ${xhr.status} - ${errorText}`));
            }
          } catch (parseError) {
            console.error('❌ Error parsing Pinata response:', parseError);
            reject(new Error('Failed to parse Pinata response'));
          }
        };

        xhr.onerror = () => {
          console.error('❌ Pinata upload network error');
          reject(new Error('Network error during Pinata upload'));
        };

        xhr.open('POST', `${PINATA_API_URL}/pinning/pinFileToIPFS`);
        
        // Set headers
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        
        xhr.send(formData);
      });

    } catch (error) {
      console.error('❌ Pinata upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown Pinata error';
      
      return {
        ipfsHash: '',
        pinSize: 0,
        timestamp: '',
        success: false,
        error: errorMessage,
        gatewayUrl: ''
      };
    }
  }

  async unpinFile(ipfsHash: string): Promise<boolean> {
    try {
      console.log('🟣 Unpinning from Pinata:', ipfsHash);
      
      const headers: HeadersInit = {};
      if (this.jwt) {
        headers['Authorization'] = `Bearer ${this.jwt}`;
      } else if (this.apiKey && this.apiSecret) {
        headers['pinata_api_key'] = this.apiKey;
        headers['pinata_secret_api_key'] = this.apiSecret;
      }

      const response = await fetch(`${PINATA_API_URL}/pinning/unpin/${ipfsHash}`, {
        method: 'DELETE',
        headers: headers
      });

      if (response.ok) {
        console.log('✅ File unpinned from Pinata');
        return true;
      } else {
        console.error('❌ Pinata unpin failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Pinata unpin error:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🟣 Testing Pinata connection...');
      
      const headers: HeadersInit = {};
      if (this.jwt) {
        headers['Authorization'] = `Bearer ${this.jwt}`;
      } else if (this.apiKey && this.apiSecret) {
        headers['pinata_api_key'] = this.apiKey;
        headers['pinata_secret_api_key'] = this.apiSecret;
      }

      const response = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Pinata connection successful:', result.message);
        return true;
      } else {
        console.error('❌ Pinata connection failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Pinata connection error:', error);
      return false;
    }
  }

  generateGatewayUrl(ipfsHash: string): string {
    return `${PINATA_GATEWAY}/ipfs/${ipfsHash}`;
  }
}

// Export singleton instance
export const pinataService = new PinataService();

// Utility function to upload encrypted data to Pinata
export async function uploadToPinata(
  encryptedData: Uint8Array,
  filename?: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<PinataUploadResult> {
  return await pinataService.pinFileToIPFS(encryptedData, filename, onProgress);
} 
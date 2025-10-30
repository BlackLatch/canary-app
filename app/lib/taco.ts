// Enhanced TACo integration with Dossier contract conditions
import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { EIP4361AuthProvider, USER_ADDRESS_PARAM_DEFAULT } from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { uploadToCodex, CodexUploadResult } from './codex';
import { uploadToPinata, PinataUploadResult } from './pinata';
import { uploadToIPFS, IPFSUploadResult } from './ipfs';
import { CANARY_DOSSIER_ADDRESS, CANARY_DOSSIER_ABI } from './contract';
import { statusSepolia } from './chains/status';
import { getPrivyEthersProvider } from './ethers-adapter';
import { switchToStatusNetwork } from './network-switch';

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
  // File metadata
  original_filename: string;
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
   * Create a Dossier contract condition using JSON-RPC
   * This allows TACo nodes to query the Status Network endpoint
   */
  private createDossierCondition(userAddress: string, dossierId: bigint) {
    console.log(`🔒 Creating JSON-RPC Dossier condition: user=${userAddress}, dossier=${dossierId.toString()}`);
    console.log(`📍 Contract: ${CANARY_DOSSIER_ADDRESS} on Status Network Sepolia`);
    console.log(`🌐 Using Status Network RPC endpoint for condition verification`);

    // Use RpcCondition to allow TACo nodes to query Status Network
    // This is necessary because TACo nodes need to be able to check the condition
    // against the Status Network where our contract is deployed
    return new conditions.base.rpc.RpcCondition({
      chain: statusSepolia.id,
      method: 'eth_call',
      parameters: [
        {
          to: CANARY_DOSSIER_ADDRESS,
          // Encode the function call for shouldDossierStayEncrypted(address,uint256)
          // Function selector: keccak256("shouldDossierStayEncrypted(address,uint256)") = 0x8a0e5d8a
          data: this.encodeFunctionCall(
            'shouldDossierStayEncrypted(address,uint256)',
            ['address', 'uint256'],
            [userAddress, dossierId.toString()]
          )
        },
        'latest'  // Block parameter
      ],
      returnValueTest: {
        comparator: '==',
        // The function returns false (0x0...0 padded to 32 bytes) when decryption is allowed
        value: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
      // Specify the RPC endpoint for Status Network Sepolia
      // This ensures TACo nodes know where to query the contract
      conditionVariables: {
        ':rpcEndpoint': 'https://public.sepolia.rpc.status.network'
      }
    });
  }

  /**
   * Helper function to encode function calls for JSON-RPC
   */
  private encodeFunctionCall(signature: string, types: string[], values: any[]): string {
    const { ethers } = require('ethers');

    // Calculate function selector (first 4 bytes of keccak256 hash)
    const functionSelector = ethers.utils.id(signature).slice(0, 10);

    // Encode parameters
    const encodedParams = ethers.utils.defaultAbiCoder.encode(types, values).slice(2);

    // Combine selector and encoded parameters
    return functionSelector + encodedParams;
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
    walletProvider?: any,
    burnerWallet?: any
  ): Promise<EncryptionResult> {
    await this.initialize();

    let signer: ethers.Signer;

    // IMPORTANT: TACo needs a provider connected to Polygon Amoy (where TACo infrastructure exists)
    // The contract condition will point to Status Network (where our Dossier contract lives)
    console.log('🔗 Creating TACo provider connected to Polygon Amoy (for TACo infrastructure)');
    const tacoProvider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');

    // Handle burner wallet differently - it's an ethers.Wallet instance
    if (burnerWallet) {
      console.log('🔥 Using burner wallet for encryption');
      // Connect burner wallet to Polygon Amoy for signing
      signer = burnerWallet.connect(tacoProvider);
      console.log('🔥 Burner wallet connected for TACo encryption');
    } else {
      // Get the ethers provider from Privy (handles embedded wallets)
      const privyProvider = await getPrivyEthersProvider(walletProvider);

      // Get the signer - for embedded wallets, we should use the default signer
      // not the smart wallet address
      console.log('🔐 Getting signer from provider...');
      signer = privyProvider.getSigner(); // Don't pass address, let provider use its default
    }

    // Log the actual signer address for debugging
    try {
      const signerAddress = await signer.getAddress();
      console.log('📍 Signer address:', signerAddress);
    } catch (error) {
      console.warn('⚠️ Could not get signer address:', error);
    }

    console.log('🔒 Using JSON-RPC Dossier condition for maximum security');
    console.log('📍 Contract on Status Network, TACo infrastructure on Polygon Amoy');
    const tacoCondition = this.createDossierCondition(userAddress, dossierId);

    const fileArrayBuffer = await file.arrayBuffer();
    const message = new Uint8Array(fileArrayBuffer);

    console.log('🔐 Encrypting with JSON-RPC Dossier condition:', {
      type: 'json_rpc_condition',
      dossierId: dossierId.toString(),
      userAddress: userAddress,
      contractAddress: CANARY_DOSSIER_ADDRESS,
      contractChain: statusSepolia.id,
      rpcEndpoint: 'https://public.sepolia.rpc.status.network',
      tacoInfraChain: 'Polygon Amoy (80002)'
    });

    const messageKit = await encrypt(
      tacoProvider, // Use Polygon Amoy provider for TACo
      TACO_DOMAIN,
      message,
      tacoCondition,
      RITUAL_ID,
      signer
    );

    console.log('✅ Encryption successful with JSON-RPC Dossier condition');

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

  async decryptFile(messageKit: any, burnerWallet?: any): Promise<Uint8Array> {
    // Clear any cached auth data
    try {
      localStorage.removeItem('siwe');
      localStorage.removeItem('taco-auth');
      localStorage.removeItem('eip4361');
    } catch (e) {
      // Ignore storage errors
    }

    let provider: ethers.providers.Provider;
    let signer: ethers.Signer;

    // IMPORTANT: TACo decrypt needs a provider connected to Polygon Amoy (where TACo infrastructure exists)
    // The contract condition will be verified against Status Network (where our Dossier contract lives)
    console.log('🔗 Creating TACo provider connected to Polygon Amoy (for TACo infrastructure)');
    const tacoProvider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');

    if (burnerWallet) {
      // For burner wallet, connect to Polygon Amoy for TACo decryption
      console.log('🔥 Using burner wallet for decryption');
      provider = tacoProvider;
      signer = burnerWallet.connect(tacoProvider);
    } else {
      // Get the ethers provider from Privy (handles embedded wallets)
      const privyProvider = await getPrivyEthersProvider();
      provider = tacoProvider;
      signer = privyProvider.getSigner();
    }

    // Verify TACo provider is on Polygon Amoy (chain ID 80002)
    try {
      const network = await provider.getNetwork();
      console.log('🔗 TACo provider network:', network.chainId);

      const currentChainId = Number(network.chainId);
      const expectedChainId = 80002; // Polygon Amoy

      if (currentChainId !== expectedChainId) {
        console.warn(`⚠️ TACo provider on unexpected network: ${currentChainId}, expected Polygon Amoy (${expectedChainId})`);
      } else {
        console.log('✅ TACo provider correctly connected to Polygon Amoy');
      }
    } catch (networkError) {
      console.error('Failed to check TACo provider network:', networkError);
      // Continue anyway - TACo will handle network issues
    }

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
      // File metadata
      original_filename: commitResult.encryptionResult.originalFileName,
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
  walletProvider?: any,
  burnerWallet?: any
): Promise<EncryptionResult> {
  return await tacoService.encryptFile(file, condition, description, dossierId, userAddress, walletProvider, burnerWallet);
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
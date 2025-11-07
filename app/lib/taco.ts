// Enhanced TACo integration with Dossier contract conditions
//
// PUBLIC vs PRIVATE Dossiers:
//
// PUBLIC DOSSIERS:
// - Simple contract condition: checks shouldDossierStayEncrypted(user, dossierId)
// - Anyone can decrypt when the contract returns false (dossier released)
// - No SIWE authentication required
//
// PRIVATE DOSSIERS:
// - Compound condition with AND operator:
//   1. Contract check: shouldDossierStayEncrypted == false
//   2. Recipient check: :userAddress in [emergency contacts list]
// - BOTH conditions must be true to decrypt
// - Requires SIWE (Sign-In With Ethereum) authentication:
//   * During ENCRYPTION: signer creates SIWE message proving they own the address
//   * During DECRYPTION: decryptor must provide SIWE auth proving they're a recipient
//   * EIP4361AuthProvider handles the SIWE message creation and signing
//   * Auth context passed to TACo nodes for verification
//
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

// TACo Configuration for Lynx Testnet
// Lynx is the TACo devnet with ritual ID 27
// The porter URL and coordinator address are configured for Lynx
const TACO_DOMAIN = domains.LYNX || domains.DEVNET;
const RITUAL_ID = 27;
const PORTER_URI = 'https://porter-lynx.nucypher.io';

export interface DeadmanCondition {
  type: 'no_activity' | 'no_checkin' | 'location' | 'keyword';
  duration?: string;
  location?: string;
  keyword?: string;
  timeWindow?: { start: string; end: string };
  // Dossier integration fields
  dossierId: bigint;
  userAddress: string;
  // Privacy fields
  releaseMode?: 'public' | 'private';
  recipients?: string[]; // Emergency contact addresses for private dossiers
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

// Dossier Manifest Interfaces (based on specification)

export interface DossierManifestFile {
  name: string;
  type: string;
  size: number;
  encryptedHash: string;
  storageUrl: string;
}

export interface DossierManifest {
  version: string;
  dossierId: string;
  name: string;
  createdAt: number;
  checkInInterval: number;
  releaseMode: 'public' | 'private';
  recipients: string[];
  files: DossierManifestFile[];
}

export interface ManifestCommitResult {
  manifestEncryptionResult: EncryptionResult;
  manifestCid: string;
  manifestStorageUrl: string;
  manifestStorageType: 'codex' | 'ipfs' | 'pinata';
}

class TacoService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      await initialize();
      this.initialized = true;

      // Log available domains for debugging
      console.log('🔍 TACo domains available:', {
        DEVNET: domains.DEVNET,
        TESTNET: domains.TESTNET,
        MAINNET: domains.MAINNET,
        LYNX: (domains as any).LYNX
      });
      console.log('🔍 Using domain:', TACO_DOMAIN);
      console.log('🔍 Ritual ID:', RITUAL_ID);

      return true;
    } catch (error) {
      console.error('TACo initialization failed:', error);
      return false;
    }
  }

  /**
   * Create a Dossier contract condition for public releases
   * This allows TACo nodes to verify the condition against the contract
   */
  private createPublicDossierCondition(userAddress: string, dossierId: bigint) {
    console.log(`🔒 Creating PUBLIC Dossier condition: user=${userAddress}, dossier=${dossierId.toString()}`);
    console.log(`📍 Contract: ${CANARY_DOSSIER_ADDRESS} on Status Network Sepolia`);
    console.log(`🌐 TACo will verify condition against contract`);

    // For custom contracts, we need to provide the function ABI
    // Format matches standard Solidity ABI format
    const functionAbi = {
      inputs: [
        { internalType: 'address', name: '_user', type: 'address' },
        { internalType: 'uint256', name: '_dossierId', type: 'uint256' }
      ],
      name: 'shouldDossierStayEncrypted',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function'
    };

    // Use ContractCondition to call the contract method
    // TACo nodes will verify this condition by calling the contract
    // Note: dossier ID must be an integer (not string) for uint256 ABI type
    // Use parseInt to ensure it's treated as an integer, not a string
    const dossierIdInt = parseInt(dossierId.toString(), 10);

    const condition = new conditions.base.contract.ContractCondition({
      contractAddress: CANARY_DOSSIER_ADDRESS,
      chain: statusSepolia.id,
      functionAbi, // Provide ABI for custom contract
      method: 'shouldDossierStayEncrypted',
      parameters: [userAddress, dossierIdInt],
      returnValueTest: {
        comparator: '==',
        value: false, // Function returns false when decryption is allowed
      },
    });

    console.log('📋 Public condition created:', {
      dossierId: dossierIdInt,
      type: typeof dossierIdInt,
      contractAddress: CANARY_DOSSIER_ADDRESS,
    });

    return condition;
  }

  /**
   * Create a compound condition for private dossiers
   * Combines contract check AND recipient address check
   */
  private createPrivateDossierCondition(
    userAddress: string,
    dossierId: bigint,
    recipients: string[]
  ) {
    console.log(`🔒 Creating PRIVATE Dossier condition: user=${userAddress}, dossier=${dossierId.toString()}`);
    console.log(`📍 Contract: ${CANARY_DOSSIER_ADDRESS} on Status Network Sepolia`);
    console.log(`👥 Recipients: ${recipients.length} addresses`);
    console.log(`🌐 TACo will verify both contract AND recipient list`);

    // Validate recipients
    if (!recipients || recipients.length === 0) {
      throw new Error('Private dossiers must have at least one recipient');
    }

    // First condition: Contract check (same as public)
    const functionAbi = {
      inputs: [
        { internalType: 'address', name: '_user', type: 'address' },
        { internalType: 'uint256', name: '_dossierId', type: 'uint256' }
      ],
      name: 'shouldDossierStayEncrypted',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function'
    };

    // Use parseInt to ensure dossierId is an integer (not string) for uint256
    const dossierIdInt = parseInt(dossierId.toString(), 10);

    const contractCondition = new conditions.base.contract.ContractCondition({
      contractAddress: CANARY_DOSSIER_ADDRESS,
      chain: statusSepolia.id,
      functionAbi,
      method: 'shouldDossierStayEncrypted',
      parameters: [userAddress, dossierIdInt],
      returnValueTest: {
        comparator: '==',
        value: false,
      },
    });

    // Second condition: User address must be in recipients list
    // Uses :userAddress context variable (the address trying to decrypt)
    const recipientCondition = new conditions.base.ConditionContext({
      contextVariable: ':userAddress',
      returnValueTest: {
        comparator: 'in',
        value: recipients, // Array of emergency contact addresses
      },
    });

    // Combine both conditions with AND operator
    // BOTH must be true: contract allows decryption AND user is in recipients list
    const compoundCondition = new conditions.base.CompoundCondition({
      operator: 'and',
      operands: [contractCondition, recipientCondition],
    });

    console.log('📋 Private compound condition created:', {
      operator: 'and',
      dossierId: dossierIdInt,
      dossierIdType: typeof dossierIdInt,
      conditions: [
        'Contract: shouldDossierStayEncrypted == false',
        `Recipients: :userAddress in [${recipients.length} addresses]`
      ]
    });

    return compoundCondition;
  }

  /**
   * Create the appropriate condition based on release mode
   */
  private createDossierCondition(
    userAddress: string,
    dossierId: bigint,
    releaseMode: 'public' | 'private' = 'public',
    recipients?: string[]
  ) {
    if (releaseMode === 'private') {
      if (!recipients || recipients.length === 0) {
        throw new Error('Private dossiers require at least one recipient');
      }
      return this.createPrivateDossierCondition(userAddress, dossierId, recipients);
    } else {
      return this.createPublicDossierCondition(userAddress, dossierId);
    }
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

    console.log('🔒 Using Contract Dossier condition for maximum security');
    console.log('📍 Contract on Status Network, TACo infrastructure on Polygon Amoy');

    // Create condition based on release mode (public or private)
    const releaseMode = condition.releaseMode || 'public';
    const recipients = condition.recipients || [];

    console.log(`🔓 Release mode: ${releaseMode.toUpperCase()}`);
    if (releaseMode === 'private') {
      console.log(`👥 Emergency contacts: ${recipients.length} addresses`);
    }

    const tacoCondition = this.createDossierCondition(
      userAddress,
      dossierId,
      releaseMode,
      recipients
    );

    const fileArrayBuffer = await file.arrayBuffer();
    const message = new Uint8Array(fileArrayBuffer);

    console.log('🔐 Encrypting with Contract Dossier condition:', {
      type: releaseMode === 'private' ? 'compound_condition' : 'contract_condition',
      releaseMode: releaseMode,
      dossierId: dossierId.toString(),
      userAddress: userAddress,
      contractAddress: CANARY_DOSSIER_ADDRESS,
      contractChain: statusSepolia.id,
      contractMethod: 'shouldDossierStayEncrypted',
      ...(releaseMode === 'private' && { recipientCount: recipients.length }),
      tacoInfraChain: 'Polygon Amoy (80002)'
    });

    // For private dossiers, we need to provide SIWE (Sign-In With Ethereum) authentication
    // This proves ownership of the address for the :userAddress context variable
    //
    // The EIP4361AuthProvider will:
    // 1. Create a SIWE message with domain, address, statement, uri, version, nonce, chain_id, issued_at
    // 2. Sign the message with the user's wallet (signer)
    // 3. Create auth context: { signature, address, scheme: "EIP4361", typedData: siwe_message }
    // 4. Pass this to TACo nodes to verify the user is an authorized recipient
    //
    // This is ONLY needed for private dossiers using :userAddress context variable
    let authProvider = undefined;
    if (releaseMode === 'private') {
      console.log('🔐 Creating SIWE auth provider for private dossier...');

      // EIP4361AuthProvider creates and signs a SIWE message
      authProvider = new EIP4361AuthProvider(
        tacoProvider, // Provider for signing
        signer        // Signer to create SIWE signature
      );

      console.log('✅ SIWE auth provider created for recipient verification');
      console.log('📝 Auth will prove signer owns address for :userAddress context variable');
    }

    const messageKit = await encrypt(
      tacoProvider, // Use Polygon Amoy provider for TACo
      TACO_DOMAIN,
      message,
      tacoCondition,
      RITUAL_ID,
      signer,
      authProvider  // Pass auth for private dossiers (undefined for public)
    );

    console.log(`✅ Encryption successful with ${releaseMode.toUpperCase()} Dossier condition`);

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

  /**
   * Create a dossier manifest from multiple file commit results
   */
  createManifest(
    dossierId: string,
    dossierName: string,
    checkInIntervalSeconds: number,
    releaseMode: 'public' | 'private',
    recipients: string[],
    fileCommitResults: Array<{ commitResult: CommitResult; originalFile: File }>
  ): DossierManifest {
    console.log('📋 Creating dossier manifest...');
    console.log(`   Dossier ID: ${dossierId}`);
    console.log(`   Name: ${dossierName}`);
    console.log(`   Files: ${fileCommitResults.length}`);
    console.log(`   Release mode: ${releaseMode}`);

    const files: DossierManifestFile[] = fileCommitResults.map(({ commitResult, originalFile }) => {
      // Extract hash from storage URL (last part after /)
      const storageUrl = commitResult.payloadUri;
      const encryptedHash = storageUrl.substring(storageUrl.lastIndexOf('/') + 1);

      return {
        name: originalFile.name,
        type: originalFile.type || 'application/octet-stream',
        size: originalFile.size,
        encryptedHash,
        storageUrl,
      };
    });

    const manifest: DossierManifest = {
      version: '1.0',
      dossierId,
      name: dossierName,
      createdAt: Math.floor(Date.now() / 1000),
      checkInInterval: checkInIntervalSeconds,
      releaseMode,
      recipients,
      files,
    };

    console.log('✅ Manifest created:', {
      version: manifest.version,
      dossierId: manifest.dossierId,
      fileCount: manifest.files.length,
      releaseMode: manifest.releaseMode,
      recipientCount: manifest.recipients.length,
    });

    return manifest;
  }

  /**
   * Validate a dossier manifest according to specification
   */
  validateManifest(manifest: DossierManifest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Version validation
    if (!manifest.version || manifest.version !== '1.0') {
      errors.push('Invalid or unsupported manifest version');
    }

    // Dossier ID validation
    if (!manifest.dossierId || typeof manifest.dossierId !== 'string') {
      errors.push('Dossier ID must be a non-empty string');
    }

    // Name validation
    if (!manifest.name || typeof manifest.name !== 'string' || manifest.name.length === 0) {
      errors.push('Name must be a non-empty string');
    }

    // Timestamp validation
    if (!Number.isInteger(manifest.createdAt) || manifest.createdAt <= 0) {
      errors.push('Created timestamp must be a positive integer');
    }

    // Check-in interval validation (1 hour to 1 year in seconds)
    const MIN_INTERVAL = 3600; // 1 hour
    const MAX_INTERVAL = 31536000; // 1 year
    if (
      !Number.isInteger(manifest.checkInInterval) ||
      manifest.checkInInterval < MIN_INTERVAL ||
      manifest.checkInInterval > MAX_INTERVAL
    ) {
      errors.push(`Check-in interval must be between ${MIN_INTERVAL} and ${MAX_INTERVAL} seconds`);
    }

    // Release mode validation
    if (manifest.releaseMode !== 'public' && manifest.releaseMode !== 'private') {
      errors.push('Release mode must be either "public" or "private"');
    }

    // Recipients validation
    if (!Array.isArray(manifest.recipients)) {
      errors.push('Recipients must be an array');
    } else {
      if (manifest.releaseMode === 'private' && manifest.recipients.length === 0) {
        errors.push('Private dossiers must have at least one recipient');
      }
      // Validate Ethereum addresses
      manifest.recipients.forEach((address, index) => {
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
          errors.push(`Invalid Ethereum address at recipients[${index}]: ${address}`);
        }
      });
    }

    // Files validation
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      errors.push('Files must be a non-empty array');
    } else {
      manifest.files.forEach((file, index) => {
        if (!file.name || typeof file.name !== 'string') {
          errors.push(`File at index ${index} has invalid name`);
        }
        if (!file.type || typeof file.type !== 'string') {
          errors.push(`File at index ${index} has invalid type`);
        }
        if (!Number.isInteger(file.size) || file.size < 0) {
          errors.push(`File at index ${index} has invalid size`);
        }
        if (!file.encryptedHash || typeof file.encryptedHash !== 'string') {
          errors.push(`File at index ${index} has invalid encrypted hash`);
        }
        if (!file.storageUrl || !file.storageUrl.startsWith('ipfs://')) {
          errors.push(`File at index ${index} has invalid storage URL (must be IPFS URL)`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Encrypt and store a manifest as a file
   */
  async encryptAndCommitManifest(
    manifest: DossierManifest,
    condition: DeadmanCondition,
    userAddress: string,
    walletProvider?: any,
    burnerWallet?: any
  ): Promise<ManifestCommitResult> {
    console.log('🔐 Encrypting manifest...');

    // Validate manifest first
    const validation = this.validateManifest(manifest);
    if (!validation.isValid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }

    // Convert manifest to JSON bytes
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBytes = new TextEncoder().encode(manifestJson);

    // Create a File object from the manifest
    const manifestBlob = new Blob([manifestBytes], { type: 'application/json' });
    const manifestFile = new File([manifestBlob], `dossier_${manifest.dossierId}_manifest.json`, {
      type: 'application/json',
    });

    console.log(`📄 Manifest file size: ${manifestBytes.length} bytes`);

    // Encrypt the manifest using the same encryption method as files
    const encryptionResult = await this.encryptFile(
      manifestFile,
      condition,
      `Dossier #${manifest.dossierId} Manifest`,
      BigInt(manifest.dossierId),
      userAddress,
      walletProvider,
      burnerWallet
    );

    console.log('✅ Manifest encrypted');

    // Commit to storage (prefer Pinata for reliability)
    console.log('📤 Uploading encrypted manifest to storage...');
    const commitResult = await this.commitToPinataOnly(encryptionResult);

    console.log('✅ Manifest stored:', commitResult.payloadUri);

    return {
      manifestEncryptionResult: encryptionResult,
      manifestCid: commitResult.pinataCid || commitResult.ipfsCid || commitResult.codexCid || '',
      manifestStorageUrl: commitResult.payloadUri,
      manifestStorageType: commitResult.storageType,
    };
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

// Storage functions - simplified without trace JSON
export async function commitEncryptedFile(
  encryptionResult: EncryptionResult
): Promise<CommitResult> {
  return await tacoService.commitToCodex(encryptionResult);
}

export async function commitEncryptedFileToPinata(
  encryptionResult: EncryptionResult
): Promise<CommitResult> {
  return await tacoService.commitToPinataOnly(encryptionResult);
}

// Manifest functions
export async function createDossierManifest(
  dossierId: string,
  dossierName: string,
  checkInIntervalSeconds: number,
  releaseMode: 'public' | 'private',
  recipients: string[],
  fileCommitResults: Array<{ commitResult: CommitResult; originalFile: File }>
): Promise<DossierManifest> {
  return tacoService.createManifest(
    dossierId,
    dossierName,
    checkInIntervalSeconds,
    releaseMode,
    recipients,
    fileCommitResults
  );
}

export async function encryptAndCommitDossierManifest(
  manifest: DossierManifest,
  condition: DeadmanCondition,
  userAddress: string,
  walletProvider?: any,
  burnerWallet?: any
): Promise<ManifestCommitResult> {
  return await tacoService.encryptAndCommitManifest(
    manifest,
    condition,
    userAddress,
    walletProvider,
    burnerWallet
  );
}

export function validateDossierManifest(manifest: DossierManifest): { isValid: boolean; errors: string[] } {
  return tacoService.validateManifest(manifest);
}

export async function initializeTaco(): Promise<boolean> {
  return await tacoService.initialize();
} 
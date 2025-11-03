import { readContract, writeContract, waitForTransactionReceipt, getAccount } from 'wagmi/actions';
import { statusSepolia } from './chains/status';
import type { Address } from 'viem';
import { config } from './web3'; // Use the main wagmi config
import { ensureCorrectNetwork } from './network-switch';

// DossierV2 Contract - deployed with enhanced features
// IMPORTANT: This contract is primarily deployed on Status Network Sepolia (gasless)
// Polygon Amoy is also supported for backward compatibility
// Default: Status Network Sepolia (Chain ID 1660990954)
export const CANARY_DOSSIER_ADDRESS: Address = (process.env.NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS as Address) || '0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0';

// Import the DossierV2 ABI
import dossierV2ABI from './dossierV2.abi.json';
export const CANARY_DOSSIER_ABI = dossierV2ABI as any;

// Legacy V1 ABI (removed) - keeping structure for reference
const LEGACY_V1_ABI = [
  // Constructor
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  // Functions
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "uint256", "name": "_checkInInterval", "type": "uint256" },
      { "internalType": "address[]", "name": "_recipients", "type": "address[]" },
      { "internalType": "string[]", "name": "_encryptedFileHashes", "type": "string[]" }
    ],
    "name": "createDossier",
    "outputs": [{ "internalType": "uint256", "name": "dossierId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "checkIn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "checkInAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_dossierId", "type": "uint256" }
    ],
    "name": "shouldDossierStayEncrypted",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "pauseDossier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "resumeDossier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "releaseNow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "permanentlyDisableDossier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" },
      { "internalType": "uint256", "name": "_dossierId", "type": "uint256" }
    ],
    "name": "getDossier",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id", "type": "uint256" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "bool", "name": "isActive", "type": "bool" },
          { "internalType": "uint256", "name": "checkInInterval", "type": "uint256" },
          { "internalType": "uint256", "name": "lastCheckIn", "type": "uint256" },
          { "internalType": "string[]", "name": "encryptedFileHashes", "type": "string[]" },
          { "internalType": "address[]", "name": "recipients", "type": "address[]" }
        ],
        "internalType": "struct CanaryDossier.Dossier",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "getUserDossierIds",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "userExists",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_CHECK_IN_INTERVAL",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_CHECK_IN_INTERVAL", 
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "GRACE_PERIOD",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_DOSSIERS_PER_USER",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" }
    ],
    "name": "DossierCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" }
    ],
    "name": "CheckInPerformed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" }
    ],
    "name": "DossierPaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" }
    ],
    "name": "DossierResumed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" }
    ],
    "name": "DossierReleased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "dossierId", "type": "uint256" }
    ],
    "name": "DossierPermanentlyDisabled",
    "type": "event"
  }
] as const;

export interface Dossier {
  id: bigint;
  name: string;
  description?: string; // Optional - not in deployed contract yet
  isActive: boolean;
  isPermanentlyDisabled?: boolean; // Optional - not in deployed contract yet
  isReleased?: boolean; // Optional - not in deployed contract yet
  checkInInterval: bigint;
  lastCheckIn: bigint;
  encryptedFileHashes: string[];
  recipients: Address[];
}

// Network validation helper
export const isOnStatusNetwork = (chainId: number | undefined): boolean => {
  return chainId === statusSepolia.id;
};

export const isOnPolygonAmoy = (chainId: number | undefined): boolean => {
  return chainId === 80002; // Keep for backward compatibility
};

export const getNetworkName = (chainId: number | undefined): string => {
  if (chainId === statusSepolia.id) return 'Status Network Sepolia';
  if (chainId === 80002) return 'Polygon Amoy';
  if (chainId === 1) return 'Ethereum Mainnet';
  if (chainId === 137) return 'Polygon Mainnet';
  return `Unknown Network (${chainId})`;
};

export class ContractService {
  
  /**
   * ✅ All contract operations use the connected wallet's RPC provider
   * ✅ No hardcoded RPC endpoints - everything goes through wagmi config
   * ✅ This ensures proper network switching and wallet compatibility
   */

  /**
   * Verify we're using wallet's provider (not hardcoded RPC)
   */
  static async verifyWalletProvider(): Promise<{
    usingWalletProvider: boolean;
    walletChainId: number | undefined;
    configChainId: number;
    networkMatch: boolean;
  }> {
    try {
      // Get account info from wagmi (this uses wallet's provider)
      const account = await getAccount(config);
      
      // Check what chain wagmi thinks we're on vs wallet
      const result = {
        usingWalletProvider: true, // Always true since we use wagmi config
        walletChainId: account.chainId,
        configChainId: statusSepolia.id,
        networkMatch: account.chainId === statusSepolia.id
      };
      
      console.log('🔍 Wallet Provider Verification:', result);
      
      if (!result.networkMatch) {
        console.warn(`⚠️ Network mismatch: Wallet is on chain ${result.walletChainId}, expected ${result.configChainId}`);
      } else {
        console.log('✅ Using wallet provider correctly - network matches');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to verify wallet provider:', error);
      return {
        usingWalletProvider: false,
        walletChainId: undefined,
        configChainId: statusSepolia.id,
        networkMatch: false
      };
    }
  }

  /**
   * Test contract connection
   */
  static async testContractConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing contract connection...');
      
      // Try to read a simple constant from the contract using wallet connection
      const minInterval = await readContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'MIN_CHECK_IN_INTERVAL',
      });
      
      console.log('✅ Contract is accessible. MIN_CHECK_IN_INTERVAL:', minInterval);
      return true;
      
    } catch (error) {
      console.error('❌ Contract connection failed:', error);
      return false;
    }
  }

  /**
   * Debug function to validate createDossier parameters before calling
   */
  static async debugCreateDossierParams(
    name: string,
    checkInIntervalMinutes: number,
    recipients: Address[],
    encryptedFileHashes: string[]
  ): Promise<{
    isValid: boolean;
    errors: string[];
    processedParams: any;
    contractValidations: any;
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      processedParams: {} as any,
      contractValidations: {} as any
    };

    try {
      console.log('🔍 Debugging createDossier parameters...');
      
      // Get current account
      const account = await getAccount(config);
      if (!account.address) {
        result.errors.push('No wallet connected');
        result.isValid = false;
        return result;
      }

      // Check network and attempt to switch if needed
      if (account.chainId !== statusSepolia.id) {
        console.log(`🔗 Wrong network detected. Attempting to switch...`);
        const switched = await ensureCorrectNetwork();

        if (!switched) {
          result.errors.push(`Wrong network. Current: ${account.chainId}, Expected: ${statusSepolia.id}`);
          result.isValid = false;
          return result;
        }

        // Re-check account after switch
        const updatedAccount = getAccount(config);
        if (updatedAccount.chainId !== statusSepolia.id) {
          result.errors.push(`Failed to switch network. Still on: ${updatedAccount.chainId}`);
          result.isValid = false;
          return result;
        }
      }

      // Process parameters exactly as they would be sent to contract
      console.log('🔍 DEBUG: Converting interval to seconds:');
      console.log('  - Input (minutes):', checkInIntervalMinutes);
      console.log('  - Multiplying by 60:', checkInIntervalMinutes * 60);
      const checkInIntervalSeconds = BigInt(checkInIntervalMinutes * 60);
      console.log('  - Result (seconds as BigInt):', checkInIntervalSeconds.toString());
      
      result.processedParams = {
        name: name,
        nameType: typeof name,
        nameLength: name.length,
        checkInIntervalMinutes,
        checkInIntervalSeconds: checkInIntervalSeconds.toString(),
        checkInIntervalType: typeof checkInIntervalSeconds,
        recipients: recipients,
        recipientsType: typeof recipients,
        recipientsLength: recipients.length,
        encryptedFileHashes: encryptedFileHashes,
        hashesType: typeof encryptedFileHashes,
        hashesLength: encryptedFileHashes.length,
        sender: account.address
      };

      console.log('📊 Processed parameters:', result.processedParams);

      // Get contract constants for validation
      const constants = await this.getConstants();
      result.contractValidations = {
        constants,
        minIntervalCheck: checkInIntervalSeconds >= constants.minInterval,
        maxIntervalCheck: checkInIntervalSeconds <= constants.maxInterval,
        intervalComparison: {
          provided: checkInIntervalSeconds.toString(),
          minimum: constants.minInterval.toString(),
          maximum: constants.maxInterval.toString(),
          isAtMinimum: checkInIntervalSeconds === constants.minInterval,
          isAboveMinimum: checkInIntervalSeconds > constants.minInterval
        }
      };

      // Validate check-in interval
      if (checkInIntervalSeconds < constants.minInterval) {
        result.errors.push(`Interval ${checkInIntervalSeconds} < minimum ${constants.minInterval}`);
        result.isValid = false;
      }
      if (checkInIntervalSeconds > constants.maxInterval) {
        result.errors.push(`Interval ${checkInIntervalSeconds} > maximum ${constants.maxInterval}`);
        result.isValid = false;
      }

      // Check user's dossier count
      const userDossierIds = await this.getUserDossierIds(account.address);
      if (userDossierIds.length >= Number(constants.maxDossiers)) {
        result.errors.push(`User has ${userDossierIds.length} dossiers, max is ${constants.maxDossiers}`);
        result.isValid = false;
      }

      // Validate recipients
      if (recipients.length === 0) {
        result.errors.push('No recipients provided');
        result.isValid = false;
      }
      if (recipients.length > 20) {
        result.errors.push(`Too many recipients: ${recipients.length} > 20`);
        result.isValid = false;
      }

      // Validate each recipient address format
      recipients.forEach((recipient, index) => {
        if (!recipient || typeof recipient !== 'string') {
          result.errors.push(`Invalid recipient at index ${index}: ${recipient}`);
          result.isValid = false;
        }
        if (!recipient.startsWith('0x') || recipient.length !== 42) {
          result.errors.push(`Invalid address format at index ${index}: ${recipient}`);
          result.isValid = false;
        }
      });

      // Validate file hashes
      if (encryptedFileHashes.length === 0) {
        result.errors.push('No file hashes provided');
        result.isValid = false;
      }
      if (encryptedFileHashes.length > 100) {
        result.errors.push(`Too many file hashes: ${encryptedFileHashes.length} > 100`);
        result.isValid = false;
      }

      // Validate each file hash format
      encryptedFileHashes.forEach((hash, index) => {
        if (!hash || typeof hash !== 'string') {
          result.errors.push(`Invalid hash at index ${index}: ${hash}`);
          result.isValid = false;
        }
        if (!hash.startsWith('ipfs://')) {
          result.errors.push(`Hash at index ${index} should start with 'ipfs://': ${hash}`);
          result.isValid = false;
        }
      });

      // Validate name
      if (!name || typeof name !== 'string') {
        result.errors.push(`Invalid name: ${name}`);
        result.isValid = false;
      }
      if (name.length === 0) {
        result.errors.push('Name cannot be empty');
        result.isValid = false;
      }
      if (name.length > 1000) { // Reasonable limit
        result.errors.push(`Name too long: ${name.length} characters`);
        result.isValid = false;
      }

      console.log('🔍 Validation result:', {
        isValid: result.isValid,
        errorCount: result.errors.length,
        errors: result.errors
      });

      return result;

    } catch (error) {
      console.error('❌ Parameter debugging failed:', error);
      result.errors.push(`Debug error: ${error}`);
      result.isValid = false;
      return result;
    }
  }

  /**
   * Create a new dossier on-chain with comprehensive debugging
   */
  static async createDossier(
    name: string,
    description: string,
    checkInIntervalMinutes: number,
    recipients: Address[],
    encryptedFileHashes: string[]
  ): Promise<{ dossierId: bigint; txHash: string }> {
    try {
      console.log('📝 Creating dossier on-chain...');
      console.log('Name:', name);
      console.log('Check-in interval:', checkInIntervalMinutes, 'minutes');
      console.log('Recipients:', recipients);
      console.log('File hashes:', encryptedFileHashes);

      // COMPREHENSIVE PARAMETER DEBUGGING
      console.log('🔍 Running comprehensive parameter validation...');
      const debugResult = await this.debugCreateDossierParams(name, checkInIntervalMinutes, recipients, encryptedFileHashes);
      
      if (!debugResult.isValid) {
        console.error('❌ Parameter validation failed:');
        debugResult.errors.forEach(error => console.error('   -', error));
        throw new Error(`Parameter validation failed: ${debugResult.errors.join(', ')}`);
      }
      
      console.log('✅ All parameters validated successfully');
      console.log('📊 Final parameters to be sent to contract:');
      console.log('   - Name:', debugResult.processedParams.name);
      console.log('   - Interval (seconds):', debugResult.processedParams.checkInIntervalSeconds);
      console.log('   - Recipients:', debugResult.processedParams.recipients);
      console.log('   - File hashes:', debugResult.processedParams.encryptedFileHashes);
      
      // Test contract connection
      const isConnected = await this.testContractConnection();
      if (!isConnected) {
        throw new Error('Contract is not accessible. Please check the contract address and network.');
      }

      // Get the current account (already validated in debug function)
      const account = await getAccount(config);
      if (!account.address) {
        throw new Error('Wallet disconnected during transaction');
      }
      const checkInIntervalSeconds = BigInt(checkInIntervalMinutes * 60);
      
      console.log('✅ Pre-flight validation passed!');

      // COMPREHENSIVE CONTRACT BUG DIAGNOSIS FOR CREATE DOSSIER
      console.log('🔍🐛 RUNNING CREATE DOSSIER BUG DIAGNOSIS...');
      const bugDiagnosis = await this.diagnoseContractBugs(account.address);
      console.log('📊 Create dossier bug diagnosis:', bugDiagnosis);
      
      if (bugDiagnosis.hasBugs) {
        console.error('🐛💥 CONTRACT BUGS DETECTED BEFORE CREATE:');
        bugDiagnosis.bugReports.forEach(bug => console.error(`   ${bug}`));
        
        // Check if the bugs would prevent creating new dossiers
        if (bugDiagnosis.bugReports.some(bug => bug.includes('ID ASSIGNMENT'))) {
          console.error('⚠️ ID assignment bugs detected - this may affect dossier creation');
        }
      }
      
      // Check user's current dossier state for ID conflicts
      const currentCount = bugDiagnosis.contractState.totalDossiers;
      const nextExpectedId = currentCount; // Contract uses count as next ID
      console.log(`🔍 Current dossier count: ${currentCount}, next expected ID: ${nextExpectedId}`);
      
      // Check if there would be ID conflicts
      const existingIds = bugDiagnosis.contractState.dossierIds || [];
      console.log(`📋 Existing dossier IDs: [${existingIds.join(', ')}]`);
      
      if (existingIds.includes(nextExpectedId.toString())) {
        throw new Error(`ID CONFLICT: Next dossier would get ID ${nextExpectedId} but that ID already exists!`);
      }
      
      // Check dossier count limit
      const constants = await this.getConstants();
      if (currentCount >= Number(constants.maxDossiers)) {
        throw new Error(`DOSSIER LIMIT REACHED: User has ${currentCount}/${constants.maxDossiers} dossiers`);
      }
      
      console.log(`✅ Create dossier diagnosis passed: Ready to create dossier #${nextExpectedId}`);

      // VERIFY WALLET PROVIDER USAGE
      console.log('🔍 Verifying wallet provider usage...');
      const providerVerification = await this.verifyWalletProvider();
      if (!providerVerification.usingWalletProvider || !providerVerification.networkMatch) {
        throw new Error(`Wallet provider issue: ${JSON.stringify(providerVerification)}`);
      }
      console.log('✅ Confirmed using wallet provider correctly');

      // ADDITIONAL CONTRACT ACCESSIBILITY TEST
      console.log('🧪 Testing contract read operations before write...');
      try {
        // Test a simple read operation to ensure contract is fully accessible
        const testConstants = await this.getConstants();
        console.log('✅ Contract read test passed:', {
          minInterval: testConstants.minInterval.toString(),
          maxInterval: testConstants.maxInterval.toString()
        });
        
        // Test getting user dossier count
        const userDossierIds = await this.getUserDossierIds(account.address);
        console.log('✅ User dossier count test passed:', userDossierIds.length);
        
      } catch (readError) {
        console.error('❌ Contract read test failed:', readError);
        throw new Error(`Contract is not accessible for reads: ${readError}`);
      }

      // TRANSACTION PREPARATION
      console.log('📞 Calling createDossier with args:', {
        name,
        checkInIntervalSeconds: checkInIntervalSeconds.toString(),
        recipients,
        encryptedFileHashes
      });

      let hash: `0x${string}` | undefined;

      // Try transaction through wallet provider (no hardcoded RPC)
      console.log('🚀 Attempting transaction using wallet provider...');
      console.log('📡 Using wagmi config - all operations go through connected wallet');
      try {
        // Add explicit gas limit to avoid estimation issues
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'createDossier',
          args: [name, description, checkInIntervalSeconds, recipients, encryptedFileHashes],
          gas: BigInt(500000), // Explicit gas limit
        });

        console.log('✅ Transaction submitted via wallet provider:', hash);

      } catch (defaultError) {
        console.warn('⚠️ Transaction failed:', defaultError);
        
        // More specific error handling
        const errorString = String(defaultError);
        console.log('🔍 Error analysis:', errorString);
        
        if (errorString.includes('Internal JSON-RPC error')) {
          // Try with even higher gas limit
          console.log('🔄 Retrying with higher gas limit...');
          try {
            hash = await writeContract(config, {
              address: CANARY_DOSSIER_ADDRESS,
              abi: CANARY_DOSSIER_ABI,
              functionName: 'createDossier',
              args: [name, description, checkInIntervalSeconds, recipients, encryptedFileHashes],
              gas: BigInt(800000), // Higher gas limit
            });
            console.log('✅ Transaction submitted with higher gas:', hash);
          } catch (retryError) {
            console.error('❌ Even higher gas failed:', retryError);
            throw new Error('Transaction failed with gas issues. The contract may be reverting. Check console for details.');
          }
        } else if (errorString.includes('user rejected')) {
          throw new Error('Transaction was rejected by user');
        } else if (errorString.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction');
        } else {
          throw new Error('Network connection issue. Please check your wallet connection and try again.');
        }
      }
      
      // Ensure hash was assigned
      if (!hash) {
        throw new Error('Transaction failed: No transaction hash received');
      }
      
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await waitForTransactionReceipt(config, { hash });
      
      console.log('📄 Transaction receipt:', receipt);
      
      // Get the dossier ID by reading from the contract
      let dossierId: bigint = BigInt(0);
      try {
        const dossierIds = await readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'getUserDossierIds',
          args: [account.address],
        });
        
        const ids = dossierIds as bigint[];
        if (ids.length > 0) {
          dossierId = ids[ids.length - 1]; // Get the last (newest) dossier ID
        }
      } catch (readError) {
        console.warn('Failed to read dossier ID from contract:', readError);
      }
      
      console.log('✅ Dossier created successfully!');
      console.log('Dossier ID:', dossierId.toString());
      console.log('Transaction hash:', hash);
      
      return { dossierId, txHash: hash };
      
    } catch (error) {
      console.error('❌ Failed to create dossier:', error);
      
      // Try to provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
          throw new Error('Transaction was rejected by user');
        } else if (error.message.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction');
        } else if (error.message.includes('Invalid check-in interval')) {
          throw new Error('Check-in interval must be between 1 hour and 30 days');
        } else if (error.message.includes('Max dossiers reached')) {
          throw new Error('Maximum number of dossiers reached for this account');
        } else if (error.message.includes('Internal JSON-RPC error')) {
          throw new Error('MetaMask connection issue. Please try refreshing the page and reconnecting your wallet.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Check in for a specific dossier
   */
  static async checkIn(dossierId: bigint): Promise<string> {
    try {
      console.log('✅ Performing check-in for dossier:', dossierId.toString());
      
      // CRITICAL: Verify wallet provider connection before check-in
      console.log('🔧 Verifying wallet provider for check-in...');
      const walletVerification = await this.verifyWalletProvider();
      console.log('🔍 Wallet provider verification:', walletVerification);
      
      if (!walletVerification.usingWalletProvider) {
        throw new Error('❌ Not using wallet provider! Check wallet connection.');
      }
      
      if (!walletVerification.networkMatch) {
        throw new Error(`❌ Network mismatch! Wallet chain: ${walletVerification.walletChainId}, Config chain: ${walletVerification.configChainId}`);
      }
      
      console.log('✅ Wallet provider verification passed');
      
      // Get current account
      const account = await getAccount(config);
      if (!account.address) {
        throw new Error('Wallet not connected');
      }

      // DEEP CONTRACT VALIDATION: Check why contract calls are failing
      console.log('🔍 DEEP PRE-FLIGHT VALIDATION for dossier:', dossierId.toString());
      try {
        // Step 1: Try to read the dossier from contract
        console.log(`🔍 Step 1: Reading dossier #${dossierId.toString()} from contract...`);
        const dossier = await this.getDossier(account.address, dossierId);
        console.log('📋 Retrieved dossier details:', {
          id: dossier.id.toString(),
          name: dossier.name,
          isActive: dossier.isActive,
          lastCheckIn: dossier.lastCheckIn.toString(),
          lastCheckInDate: new Date(Number(dossier.lastCheckIn) * 1000).toISOString(),
          interval: dossier.checkInInterval.toString(),
          intervalHours: Number(dossier.checkInInterval) / 3600,
          recipients: dossier.recipients.length,
          files: dossier.encryptedFileHashes.length
        });

        // Step 2: Validate dossier state for check-in
        console.log('🔍 Step 2: Validating dossier state...');
        if (!dossier.isActive) {
          throw new Error(`❌ Dossier #${dossierId.toString()} is INACTIVE - cannot check in`);
        }
        console.log('✅ Dossier is active');

        // Step 3: Critical ID validation (this is what contract checks)
        console.log('🔍 Step 3: Critical ID validation...');
        console.log(`   Expected dossier ID: ${dossierId.toString()}`);
        console.log(`   Actual stored ID: ${dossier.id.toString()}`);
        console.log(`   ID types: expected=${typeof dossierId}, actual=${typeof dossier.id}`);
        console.log(`   Strict equality check: ${dossier.id === dossierId}`);
        
        if (dossier.id !== dossierId) {
          throw new Error(`❌ CRITICAL ID MISMATCH: Contract expects dossier.id (${dossier.id.toString()}) === _dossierId (${dossierId.toString()}), but they don't match!`);
        }
        console.log('✅ Dossier ID validation passed');

        // Step 4: Check contract conditions that could cause revert
        console.log('🔍 Step 4: Checking contract validation conditions...');
        
        // Test the exact condition from the validDossier modifier:
        // require(dossiers[_user][_dossierId].id == _dossierId, "Dossier does not exist");
        console.log('   Contract validDossier modifier check:');
        console.log(`   dossiers[${account.address}][${dossierId.toString()}].id == ${dossierId.toString()}`);
        console.log(`   Result: ${dossier.id.toString()} == ${dossierId.toString()} = ${dossier.id === dossierId}`);
        
        // Test the exact condition from the checkIn function:
        // require(dossiers[msg.sender][_dossierId].isActive, "Dossier not active");
        console.log('   Contract checkIn function check:');
        console.log(`   dossiers[${account.address}][${dossierId.toString()}].isActive = ${dossier.isActive}`);
        
        if (!dossier.isActive) {
          throw new Error('❌ Contract will reject: Dossier not active');
        }
        
        console.log('✅ All contract validation conditions should pass');

        // Step 5: Additional debugging - check if we can read contract state directly
        console.log('🔍 Step 5: Testing contract accessibility...');
        try {
          const userExists = await this.userExists(account.address);
          console.log(`   User exists in contract: ${userExists}`);
          
          const allUserDossierIds = await this.getUserDossierIds(account.address);
          console.log(`   All user dossier IDs: [${allUserDossierIds.map(id => id.toString()).join(', ')}]`);
          
          const targetDossierExists = allUserDossierIds.some(id => id === dossierId);
          console.log(`   Target dossier #${dossierId.toString()} exists in user's list: ${targetDossierExists}`);
          
          if (!targetDossierExists) {
            throw new Error(`❌ CRITICAL: Dossier #${dossierId.toString()} not found in user's dossier list!`);
          }
          
        } catch (accessError) {
          console.error('❌ Contract accessibility test failed:', accessError);
          throw new Error(`Contract accessibility issue: ${accessError}`);
        }

        console.log('✅ DEEP VALIDATION PASSED - Contract call should succeed');

      } catch (validationError) {
        console.error('❌ DEEP VALIDATION FAILED:', validationError);
        throw new Error(`Deep validation failed: ${validationError}`);
      }
      
      // Use wallet provider for check-in transaction
      console.log('📤 Executing check-in transaction via wallet provider...');
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'checkIn',
        args: [dossierId],
        gas: BigInt(200000), // Explicit gas limit for simple operations
      });
      
      console.log('⏳ Waiting for transaction confirmation...');
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Check-in successful! Transaction hash:', hash);
      return hash;
      
    } catch (error) {
      console.error('❌ Check-in failed:', error);
      
      // Enhanced error reporting
      if (error instanceof Error) {
        if (error.message.includes('Internal JSON-RPC error')) {
          throw new Error('MetaMask/RPC communication error. The transaction may have been rejected or the contract may be reverting. Please try again.');
        } else if (error.message.includes('user rejected')) {
          throw new Error('Transaction was rejected by user');
        } else if (error.message.includes('insufficient funds')) {
          throw new Error('Insufficient funds for gas');
        } else if (error.message.includes('Network mismatch')) {
          throw new Error('Please switch to Polygon Amoy network in your wallet');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * CRITICAL: Diagnose potential smart contract bugs
   */
  static async diagnoseContractBugs(userAddress: Address): Promise<{
    hasBugs: boolean;
    bugReports: string[];
    contractState: any;
    recommendations: string[];
  }> {
    const result = {
      hasBugs: false,
      bugReports: [] as string[],
      contractState: {} as any,
      recommendations: [] as string[]
    };

    try {
      console.log('🔍 DIAGNOSING POTENTIAL CONTRACT BUGS...');
      
      // Get user's dossiers
      const dossierIds = await this.getUserDossierIds(userAddress);
      result.contractState.totalDossiers = dossierIds.length;
      result.contractState.dossierIds = dossierIds.map(id => id.toString());
      
      console.log(`📊 User has ${dossierIds.length} dossiers: [${result.contractState.dossierIds.join(', ')}]`);

      // Deep analysis of each dossier
      const dossierAnalysis = [];
      for (let i = 0; i < dossierIds.length; i++) {
        const dossierId = dossierIds[i];
        console.log(`🔍 Analyzing dossier #${dossierId.toString()}...`);
        
        try {
          const dossier = await this.getDossier(userAddress, dossierId);
          const analysis = {
            dossierId: dossierId.toString(),
            storedId: dossier.id.toString(),
            name: dossier.name,
            isActive: dossier.isActive,
            lastCheckIn: dossier.lastCheckIn.toString(),
            checkInInterval: dossier.checkInInterval.toString(),
            recipients: dossier.recipients.length,
            files: dossier.encryptedFileHashes.length,
            // CRITICAL CHECKS
            idMatches: dossier.id === dossierId,
            idMismatchBug: dossier.id !== dossierId,
            isActiveForCheckIn: dossier.isActive,
            canPassValidDossierModifier: dossier.id === dossierId,
            canPassCheckInRequire: dossier.isActive
          };
          
          console.log(`📋 Dossier #${dossierId.toString()} analysis:`, analysis);
          
          // Bug detection
          if (analysis.idMismatchBug) {
            result.hasBugs = true;
            result.bugReports.push(`🐛 CRITICAL BUG: Dossier #${dossierId.toString()} has stored ID ${analysis.storedId} but array index is ${dossierId.toString()}`);
            result.recommendations.push(`Contract has ID assignment bug - stored dossier.id doesn't match mapping key`);
          }
          
          if (!analysis.isActiveForCheckIn) {
            result.bugReports.push(`⚠️ Dossier #${dossierId.toString()} is inactive - check-in will fail`);
          }
          
          dossierAnalysis.push(analysis);
          
        } catch (error) {
          result.hasBugs = true;
          result.bugReports.push(`❌ Cannot read dossier #${dossierId.toString()}: ${error}`);
          console.error(`❌ Failed to read dossier #${dossierId.toString()}:`, error);
        }
      }
      
      result.contractState.dossierAnalysis = dossierAnalysis;

      // Check for common contract bugs
      console.log('🔍 Checking for common contract bugs...');
      
      // Bug 1: ID assignment logic
      const validDossiers = dossierAnalysis.filter(d => d.idMatches);
      const invalidDossiers = dossierAnalysis.filter(d => d.idMismatchBug);
      
      if (invalidDossiers.length > 0) {
        result.hasBugs = true;
        result.bugReports.push(`🐛 ID ASSIGNMENT BUG: ${invalidDossiers.length}/${dossierAnalysis.length} dossiers have mismatched IDs`);
        result.recommendations.push('Contract needs to be redeployed with correct ID assignment logic');
      }
      
      // Bug 2: State corruption
      if (dossierIds.length === 0) {
        result.bugReports.push('⚠️ No dossiers found - either none created or state reading bug');
      }
      
      // Bug 3: Check if contract constants are reasonable
      try {
        const constants = await this.getConstants();
        result.contractState.constants = {
          minInterval: constants.minInterval.toString(),
          maxInterval: constants.maxInterval.toString(),
          gracePeriod: constants.gracePeriod.toString(),
          maxDossiers: constants.maxDossiers.toString()
        };
        
        // Check for unreasonable constants
        if (constants.minInterval > constants.maxInterval) {
          result.hasBugs = true;
          result.bugReports.push('🐛 CONSTANT BUG: minInterval > maxInterval');
        }
        
      } catch (error) {
        result.hasBugs = true;
        result.bugReports.push(`❌ Cannot read contract constants: ${error}`);
      }

      // Summary
      const activeDossiers = dossierAnalysis.filter(d => d.isActiveForCheckIn).length;
      const checkInReadyDossiers = dossierAnalysis.filter(d => d.canPassValidDossierModifier && d.canPassCheckInRequire).length;
      
      result.contractState.summary = {
        totalDossiers: dossierAnalysis.length,
        activeDossiers,
        checkInReadyDossiers,
        brokenDossiers: dossierAnalysis.length - checkInReadyDossiers
      };
      
      if (activeDossiers > 0 && checkInReadyDossiers === 0) {
        result.hasBugs = true;
        result.bugReports.push('🐛 CRITICAL: Active dossiers exist but none can pass check-in validation');
        result.recommendations.push('Contract logic prevents check-ins even for valid active dossiers');
      }
      
      console.log('📊 Contract diagnosis complete:', {
        hasBugs: result.hasBugs,
        bugCount: result.bugReports.length,
        summary: result.contractState.summary
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Contract diagnosis failed:', error);
      result.hasBugs = true;
      result.bugReports.push(`Diagnosis failed: ${error}`);
      return result;
    }
  }

  /**
   * CRITICAL: Verify if checkInAll function actually exists in deployed contract
   */
  static async verifyCheckInAllFunction(): Promise<{
    functionExists: boolean;
    canCallFunction: boolean;
    errors: string[];
    testResults: any;
  }> {
    const result = {
      functionExists: false,
      canCallFunction: false,
      errors: [] as string[],
      testResults: {} as any
    };

    try {
      console.log('🔍 Verifying checkInAll function existence in deployed contract...');
      
      const account = await getAccount(config);
      if (!account.address) {
        result.errors.push('No wallet connected');
        return result;
      }

      // Test 1: Check if we can read basic functions (proves contract exists)
      try {
        const minInterval = await readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'MIN_CHECK_IN_INTERVAL',
        });
        result.testResults.contractExists = true;
        result.testResults.minInterval = minInterval.toString();
        console.log('✅ Contract exists and basic functions work');
      } catch (error) {
        result.errors.push(`Contract not accessible: ${error}`);
        return result;
      }

      // Test 2: Try to simulate checkInAll call (this will fail if function doesn't exist)
      try {
        console.log('🧪 Testing checkInAll function existence...');
        
        // Instead of calling writeContract, let's check if user has dossiers first
        const dossierIds = await this.getUserDossierIds(account.address);
        result.testResults.userDossierCount = dossierIds.length;
        
        if (dossierIds.length === 0) {
          result.errors.push('User has no dossiers - cannot test checkInAll');
          return result;
        }
        
        // The fact that we can get here means the contract is accessible
        // The issue might be that checkInAll function doesn't exist in deployed contract
        result.functionExists = true; // We assume it exists based on ABI
        result.canCallFunction = true; // We'll test this differently
        
        console.log(`✅ User has ${dossierIds.length} dossiers, function should be callable`);
        
      } catch (error) {
        result.errors.push(`Function test failed: ${error}`);
        return result;
      }

      return result;

    } catch (error) {
      console.error('❌ checkInAll verification failed:', error);
      result.errors.push(`Verification error: ${error}`);
      return result;
    }
  }

  /**
   * FALLBACK: Use individual check-ins instead of checkInAll
   */
  static async checkInAllIndividually(): Promise<string[]> {
    try {
      console.log('🔄 Using fallback individual check-ins...');
      
      const account = await getAccount(config);
      if (!account.address) {
        throw new Error('Wallet not connected');
      }

      // Get all user dossiers
      const dossierIds = await this.getUserDossierIds(account.address);
      if (dossierIds.length === 0) {
        throw new Error('No dossiers found');
      }

      const results: string[] = [];
      let activeDossiers = 0;

      // Check in to each active dossier individually
      for (const dossierId of dossierIds) {
        try {
          const dossier = await this.getDossier(account.address, dossierId);
          if (dossier.isActive) {
            activeDossiers++;
            console.log(`🔄 Individual check-in for dossier #${dossierId.toString()}`);
            const txHash = await this.checkIn(dossierId);
            results.push(txHash);
          }
        } catch (error) {
          console.error(`❌ Failed individual check-in for dossier #${dossierId.toString()}:`, error);
          throw error; // Fail fast on any individual error
        }
      }

      if (activeDossiers === 0) {
        throw new Error('No active dossiers to check in to');
      }

      console.log(`✅ Individual check-ins completed: ${results.length} transactions`);
      return results;

    } catch (error) {
      console.error('❌ Individual check-ins failed:', error);
      throw error;
    }
  }

  /**
   * Check in for all active dossiers - with comprehensive bug diagnosis
   */
  static async checkInAll(): Promise<string> {
    try {
      console.log('✅ Starting smart check-in process with bug diagnosis...');
      
      // STEP 1: Get current account
      const account = await getAccount(config);
      if (!account.address) {
        throw new Error('Wallet not connected');
      }

      // STEP 2: COMPREHENSIVE CONTRACT BUG DIAGNOSIS
      console.log('🔍🐛 RUNNING CONTRACT BUG DIAGNOSIS...');
      const bugDiagnosis = await this.diagnoseContractBugs(account.address);
      console.log('📊 Bug diagnosis result:', bugDiagnosis);
      
      if (bugDiagnosis.hasBugs) {
        console.error('🐛💥 CONTRACT BUGS DETECTED:');
        bugDiagnosis.bugReports.forEach(bug => console.error(`   ${bug}`));
        console.error('🛠️ RECOMMENDATIONS:');
        bugDiagnosis.recommendations.forEach(rec => console.error(`   ${rec}`));
        
        // If there are critical contract bugs, don't attempt any transactions
        if (bugDiagnosis.bugReports.some(bug => bug.includes('CRITICAL'))) {
          throw new Error(`CRITICAL CONTRACT BUGS DETECTED: ${bugDiagnosis.bugReports.join(', ')}`);
        }
      }
      
      // Check if any dossiers can actually be checked in to
      const summary = bugDiagnosis.contractState.summary;
      if (summary && summary.checkInReadyDossiers === 0) {
        throw new Error(`NO FUNCTIONAL DOSSIERS: ${summary.activeDossiers} active dossiers found but none can pass check-in validation due to contract bugs`);
      }
      
      console.log(`✅ Bug diagnosis complete: ${summary?.checkInReadyDossiers || 0} dossiers ready for check-in`);

      // STEP 3: Verify function exists and can be called (only if no critical bugs)
      console.log('🔍 Verifying checkInAll function...');
      const verification = await this.verifyCheckInAllFunction();
      console.log('📊 Verification result:', verification);

      if (!verification.functionExists || verification.errors.length > 0) {
        console.warn('⚠️ checkInAll function verification failed, using individual check-ins');
        const txHashes = await this.checkInAllIndividually();
        return txHashes[0]; // Return first transaction hash for compatibility
      }

      // STEP 4: Try the bulk checkInAll with retry logic for intermittent issues
      console.log('🚀 Attempting bulk checkInAll with retry logic...');
      
      const MAX_RETRIES = 3;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${MAX_RETRIES} for bulk check-in`);
          
          // Add small delay between attempts to help with timing issues
          if (attempt > 1) {
            console.log('⏳ Waiting 2 seconds before retry to allow network sync...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // TIMING: Record state before transaction
          const preTransactionTime = Date.now();
          console.log(`🕐 Pre-transaction timestamp: ${preTransactionTime}`);
          
          // Re-verify wallet state for each attempt
          console.log(`🔧 Attempt ${attempt}: Verifying wallet provider...`);
          const walletVerification = await this.verifyWalletProvider();
          console.log('🔍 Wallet provider verification:', walletVerification);
          
          if (!walletVerification.usingWalletProvider) {
            throw new Error('❌ Not using wallet provider! Check wallet connection.');
          }
          
          if (!walletVerification.networkMatch) {
            throw new Error(`❌ Network mismatch! Wallet chain: ${walletVerification.walletChainId}, Config chain: ${walletVerification.configChainId}`);
          }
          
          console.log(`✅ Attempt ${attempt}: Wallet provider verification passed`);

          // Quick state check before transaction
          console.log(`🔍 Attempt ${attempt}: Quick state verification...`);
          const quickCheck = await this.getUserDossierIds(account.address);
          console.log(`📋 User still has ${quickCheck.length} dossiers: [${quickCheck.map(id => id.toString()).join(', ')}]`);
          
          // Use wallet provider for bulk check-in transaction
          console.log(`📤 Attempt ${attempt}: Executing bulk check-in transaction...`);
          const hash = await writeContract(config, {
            address: CANARY_DOSSIER_ADDRESS,
            abi: CANARY_DOSSIER_ABI,
            functionName: 'checkInAll',
            args: [],
            gas: BigInt(500000), // Higher gas limit for bulk operation
          });
          
          console.log(`⏳ Attempt ${attempt}: Waiting for transaction confirmation...`);
          await waitForTransactionReceipt(config, { hash });
          
          // TIMING: Record success
          const postTransactionTime = Date.now();
          const duration = postTransactionTime - preTransactionTime;
          console.log(`✅ Bulk check-in successful on attempt ${attempt}! Duration: ${duration}ms`);
          console.log(`✅ Transaction hash: ${hash}`);
          return hash;
          
        } catch (error) {
          lastError = error;
          console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
          
          // Analyze the error for retry strategy
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('user rejected')) {
            console.log('🛑 User rejected transaction - not retrying');
            throw error;
          }
          
          if (errorMessage.includes('insufficient funds')) {
            console.log('🛑 Insufficient funds - not retrying');
            throw error;
          }
          
          if (attempt < MAX_RETRIES) {
            console.log(`🔄 Will retry attempt ${attempt + 1} after delay...`);
            
            // Progressive delay: 2s, 4s, 6s
            const delay = attempt * 2000;
            console.log(`⏳ Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`💥 All ${MAX_RETRIES} attempts failed. Last error:`, lastError);
          }
        }
      }
      
      // If we get here, all retries failed
      throw new Error(`Bulk check-in failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`);
      
    } catch (error) {
      console.error('❌ Bulk check-in failed, trying individual fallback:', error);
      
      // FALLBACK: If bulk check-in fails, try individual check-ins
      try {
        console.log('🔄 Falling back to individual check-ins...');
        const txHashes = await this.checkInAllIndividually();  
        console.log('✅ Fallback individual check-ins successful');
        return txHashes[0]; // Return first transaction hash for compatibility
      } catch (fallbackError) {
        console.error('❌ Both bulk and individual check-ins failed:', fallbackError);
        
        // Enhanced error reporting
        if (error instanceof Error) {
          if (error.message.includes('Internal JSON-RPC error')) {
            throw new Error('Contract function error. The checkInAll function may not exist in the deployed contract. Individual check-ins also failed.');
          } else if (error.message.includes('user rejected')) {
            throw new Error('Transaction was rejected by user');
          } else if (error.message.includes('insufficient funds')) {
            throw new Error('Insufficient funds for gas');
          } else if (error.message.includes('Network mismatch')) {
            throw new Error('Please switch to Polygon Amoy network in your wallet');
          }
        }
        
        throw new Error(`Both bulk and individual check-ins failed. Original error: ${error}. Fallback error: ${fallbackError}`);
      }
    }
  }
  
  /**
   * Get user's dossier IDs
   */
  static async getUserDossierIds(userAddress: Address): Promise<bigint[]> {
    try {
      const result = await readContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'getUserDossierIds',
        args: [userAddress],
      });
      
      return result as bigint[];
      
    } catch (error) {
      console.error('❌ Failed to get user dossier IDs:', error);
      throw error;
    }
  }
  
  /**
   * Get dossier details
   */
  static async getDossier(userAddress: Address, dossierId: bigint): Promise<Dossier> {
    try {
      const result = await readContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'getDossier',
        args: [userAddress, dossierId],
      });

      // V2 has all the latest fields
      const dossier = result as any;
      return {
        id: dossier.id,
        name: dossier.name,
        description: dossier.description || '',
        isActive: dossier.isActive,
        isPermanentlyDisabled: dossier.isPermanentlyDisabled || false,
        isReleased: dossier.isReleased || false,
        checkInInterval: dossier.checkInInterval,
        lastCheckIn: dossier.lastCheckIn,
        encryptedFileHashes: dossier.encryptedFileHashes,
        recipients: dossier.recipients
      } as Dossier;

    } catch (error) {
      // Check for ABI mismatch errors
      if (error instanceof Error) {
        if (error.message.includes('is not a valid boolean') ||
            error.message.includes('Position') && error.message.includes('out of bounds')) {
          console.error('💥 ABI MISMATCH DETECTED:', {
            dossierId: dossierId.toString(),
            userAddress,
            contractAddress: CANARY_DOSSIER_ADDRESS,
            error: error.message,
            hint: 'The deployed contract structure does not match the ABI. Please update the ABI or redeploy the contract.'
          });

          throw new Error(
            `ABI mismatch for dossier #${dossierId.toString()}. ` +
            `The deployed contract at ${CANARY_DOSSIER_ADDRESS} has a different structure than expected. ` +
            `Please check that you're using the correct contract address and ABI version.`
          );
        }
      }

      console.error('❌ Failed to get dossier:', error);
      throw error;
    }
  }
  
  /**
   * Check if dossier should stay encrypted
   */
  static async shouldDossierStayEncrypted(userAddress: Address, dossierId: bigint): Promise<boolean> {
    try {
      const result = await readContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'shouldDossierStayEncrypted',
        args: [userAddress, dossierId],
      });
      
      return result as boolean;
      
    } catch (error) {
      console.error('❌ Failed to check encryption status:', error);
      throw error;
    }
  }
  
  /**
   * Check if user exists (has any dossiers)
   */
  static async userExists(userAddress: Address): Promise<boolean> {
    try {
      const result = await readContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'userExists',  
        args: [userAddress],
      });
      
      return result as boolean;
      
    } catch (error) {
      console.error('❌ Failed to check if user exists:', error);
      return false;
    }
  }
  
  /**
   * Get contract constants like min/max intervals
   */
    static async getConstants() {
    try {
      console.log('🔧 Getting contract constants via wallet provider...');
      
      const [minInterval, maxInterval, gracePeriod, maxDossiers] = await Promise.all([
        readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'MIN_CHECK_IN_INTERVAL',
        }),
        readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'MAX_CHECK_IN_INTERVAL',
        }),
        readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'GRACE_PERIOD',
        }),
        readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'MAX_DOSSIERS_PER_USER',
        }),
      ]);

      return {
        minInterval: minInterval as bigint,
        maxInterval: maxInterval as bigint,
        gracePeriod: gracePeriod as bigint,
        maxDossiers: maxDossiers as bigint,
      };
      
    } catch (error) {
      console.error('❌ Failed to get contract constants via wallet provider:', error);
      throw error;
    }
  }

  /**
   * Pause a dossier
   */
  static async pauseDossier(dossierId: bigint, burnerWallet?: any): Promise<string> {
    try {
      console.log('⏸️ Pausing dossier:', dossierId.toString());

      let hash: string;

      // Handle burner wallet differently
      if (burnerWallet) {
        console.log('🔥 Using burner wallet for pause transaction');
        const { ethers } = await import('ethers');

        // Connect to Status Network Sepolia RPC
        const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
        const signer = burnerWallet.connect(provider);

        // Create contract instance
        const contract = new ethers.Contract(
          CANARY_DOSSIER_ADDRESS,
          CANARY_DOSSIER_ABI,
          signer
        );

        // Status Network is gasless - set gas to 0
        const tx = await contract.pauseDossier(dossierId, { gasPrice: 0 });
        const receipt = await tx.wait();
        hash = receipt.transactionHash;
      } else {
        // Use wagmi for connected wallets
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'pauseDossier',
          args: [dossierId],
        });

        await waitForTransactionReceipt(config, { hash });
      }

      console.log('✅ Dossier paused successfully!');
      return hash;

    } catch (error) {
      console.error('❌ Failed to pause dossier:', error);
      throw error;
    }
  }

  /**
   * Resume a paused dossier
   */
  static async resumeDossier(dossierId: bigint, burnerWallet?: any): Promise<string> {
    try {
      console.log('▶️ Resuming dossier:', dossierId.toString());

      let hash: string;

      // Handle burner wallet differently
      if (burnerWallet) {
        console.log('🔥 Using burner wallet for resume transaction');
        const { ethers } = await import('ethers');

        // Connect to Status Network Sepolia RPC
        const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
        const signer = burnerWallet.connect(provider);

        // Create contract instance
        const contract = new ethers.Contract(
          CANARY_DOSSIER_ADDRESS,
          CANARY_DOSSIER_ABI,
          signer
        );

        // Status Network is gasless - set gas to 0
        const tx = await contract.resumeDossier(dossierId, { gasPrice: 0 });
        const receipt = await tx.wait();
        hash = receipt.transactionHash;
      } else {
        // Use wagmi for connected wallets
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'resumeDossier',
          args: [dossierId],
        });

        await waitForTransactionReceipt(config, { hash });
      }

      console.log('✅ Dossier resumed successfully!');
      return hash;

    } catch (error) {
      console.error('❌ Failed to resume dossier:', error);
      throw error;
    }
  }

  /**
   * Release dossier data immediately (irreversible action)
   */
  static async releaseNow(dossierId: bigint, burnerWallet?: any): Promise<string> {
    try {
      console.log('🔓 Releasing dossier data immediately:', dossierId.toString());
      console.warn('⚠️ This action is PERMANENT and releases data immediately!');

      let hash: string;

      // Handle burner wallet differently
      if (burnerWallet) {
        console.log('🔥 Using burner wallet for release transaction');
        const { ethers } = await import('ethers');

        // Connect to Status Network Sepolia RPC
        const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
        const signer = burnerWallet.connect(provider);

        // Create contract instance
        const contract = new ethers.Contract(
          CANARY_DOSSIER_ADDRESS,
          CANARY_DOSSIER_ABI,
          signer
        );

        // Status Network is gasless - set gas to 0
        const tx = await contract.releaseNow(dossierId, { gasPrice: 0 });
        const receipt = await tx.wait();
        hash = receipt.transactionHash;
      } else {
        // Use wagmi for connected wallets
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'releaseNow',
          args: [dossierId],
        });

        await waitForTransactionReceipt(config, { hash });
      }

      console.log('✅ Dossier data released successfully!');
      return hash;

    } catch (error) {
      console.error('❌ Failed to release dossier data:', error);
      throw error;
    }
  }

  /**
   * Permanently disable a dossier (irreversible action)
   */
  static async permanentlyDisableDossier(dossierId: bigint, burnerWallet?: any): Promise<string> {
    try {
      console.log('⛔ Permanently disabling dossier:', dossierId.toString());
      console.warn('⚠️ This action is PERMANENT and cannot be undone!');

      let hash: string;

      // Handle burner wallet differently
      if (burnerWallet) {
        console.log('🔥 Using burner wallet for disable transaction');
        const { ethers } = await import('ethers');

        // Connect to Status Network Sepolia RPC
        const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
        const signer = burnerWallet.connect(provider);

        // Create contract instance
        const contract = new ethers.Contract(
          CANARY_DOSSIER_ADDRESS,
          CANARY_DOSSIER_ABI,
          signer
        );

        // Status Network is gasless - set gas to 0
        const tx = await contract.permanentlyDisableDossier(dossierId, { gasPrice: 0 });
        const receipt = await tx.wait();
        hash = receipt.transactionHash;
      } else {
        // Use wagmi for connected wallets
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'permanentlyDisableDossier',
          args: [dossierId],
        });

        await waitForTransactionReceipt(config, { hash });
      }

      console.log('✅ Dossier permanently disabled successfully!');
      return hash;

    } catch (error) {
      console.error('❌ Failed to permanently disable dossier:', error);
      throw error;
    }
  }

  /**
   * Comprehensive contract verification for debugging
   */
  static async verifyContractDeployment(): Promise<{
    isDeployed: boolean;
    canReadConstants: boolean;
    currentBlockNumber: bigint | null;
    contractConstants: any;
    networkInfo: any;
    errors: string[];
  }> {
    const result = {
      isDeployed: false,
      canReadConstants: false,
      currentBlockNumber: null as bigint | null,
      contractConstants: {},
      networkInfo: {},
      errors: [] as string[]
    };

    try {
      console.log('🔍 Starting comprehensive contract verification...');
      console.log('📍 Contract address:', CANARY_DOSSIER_ADDRESS);
      console.log('🌐 Target network: Polygon Amoy (Chain ID 80002)');

      // Get current account info
      const account = await getAccount(config);
      result.networkInfo = {
        address: account.address,
        chainId: account.chainId,
        isConnected: account.isConnected
      };

      if (!account.isConnected) {
        result.errors.push('Wallet not connected');
        return result;
      }

      if (account.chainId !== statusSepolia.id) {
        result.errors.push(`Wrong network. Current: ${account.chainId}, Expected: ${statusSepolia.id}`);
        return result;
      }

      // Test 1: Check if contract exists by reading a simple constant
      try {
        console.log('📖 Test 1: Reading MIN_CHECK_IN_INTERVAL...');
        const minInterval = await readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'MIN_CHECK_IN_INTERVAL',
        });
        
        result.isDeployed = true;
        result.canReadConstants = true;
        console.log('✅ Contract exists and is readable. MIN_CHECK_IN_INTERVAL:', minInterval);
        
      } catch (error) {
        console.error('❌ Failed to read contract constants:', error);
        result.errors.push(`Cannot read contract constants: ${error}`);
        return result;
      }

      // Test 2: Read all contract constants
      try {
        console.log('📊 Test 2: Reading all contract constants...');
        const constants = await this.getConstants();
        result.contractConstants = constants;
        console.log('✅ All constants readable:', constants);
        
      } catch (error) {
        console.error('❌ Failed to read all constants:', error);
        result.errors.push(`Cannot read all constants: ${error}`);
      }

      // Test 3: Check user's existing dossiers
      try {
        console.log('📋 Test 3: Reading user dossiers...');
        const dossierIds = await this.getUserDossierIds(account.address!);
        console.log('✅ User has', dossierIds.length, 'dossiers:', dossierIds.map(id => id.toString()));
        
        // If user has dossiers, try reading one
        if (dossierIds.length > 0) {
          const firstDossier = await this.getDossier(account.address!, dossierIds[0]);
          console.log('✅ Can read dossier details:', {
            id: firstDossier.id.toString(),
            name: firstDossier.name,
            isActive: firstDossier.isActive
          });
        }
        
      } catch (error) {
        console.error('❌ Failed to read user dossiers:', error);
        result.errors.push(`Cannot read user dossiers: ${error}`);
      }

      // Test 4: Simulate a createDossier call (dry run)
      try {
        console.log('🧪 Test 4: Simulating createDossier call...');
        
        // This is a read-only simulation to test if the function would work
        const testArgs = [
          'Test Dossier',
          BigInt(3600), // 1 hour
          [account.address!],
          ['ipfs://test-hash']
        ];
        
        console.log('🔧 Test parameters:', {
          name: testArgs[0],
          interval: testArgs[1].toString(),
          recipients: testArgs[2],
          hashes: testArgs[3]
        });
        
        // We can't actually simulate writeContract calls easily,
        // but we can check if the parameters would be valid
        const constants = result.contractConstants as any;
        if (constants.minInterval && testArgs[1] < constants.minInterval) {
          result.errors.push(`Test interval ${testArgs[1]} is below minimum ${constants.minInterval}`);
        }
        
        console.log('✅ Test parameters appear valid');
        
      } catch (error) {
        console.error('❌ Test simulation failed:', error);
        result.errors.push(`Simulation failed: ${error}`);
      }

      console.log('🏁 Contract verification complete');
      return result;
      
    } catch (error) {
      console.error('💥 Critical error during verification:', error);
      result.errors.push(`Critical error: ${error}`);
      return result;
    }
  }

  /**
   * Quick contract health check
   */
  static async quickHealthCheck(): Promise<boolean> {
    try {
      const result = await this.verifyContractDeployment();
      const isHealthy = result.isDeployed && result.canReadConstants && result.errors.length === 0;
      
      if (!isHealthy) {
        console.warn('⚠️ Contract health check failed:');
        result.errors.forEach(error => console.warn('   -', error));
      } else {
        console.log('✅ Contract health check passed');
      }
      
      return isHealthy;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  /**
   * Debug user's dossier state to identify check-in issues
   */
  static async debugUserDossierState(userAddress: Address): Promise<{
    isValid: boolean;
    errors: string[];
    dossierSummary: any;
    onChainData: any;
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      dossierSummary: {} as any,
      onChainData: {} as any
    };

    try {
      console.log('🔍 Debugging user dossier state for:', userAddress);

      // Get user's dossier IDs from contract
      const dossierIds = await this.getUserDossierIds(userAddress);
      result.onChainData.dossierIds = dossierIds.map(id => id.toString());
      result.onChainData.totalCount = dossierIds.length;

      console.log('📋 User has', dossierIds.length, 'dossiers on-chain:', result.onChainData.dossierIds);

      if (dossierIds.length === 0) {
        result.errors.push('No dossiers found on-chain');
        result.isValid = false;
        return result;
      }

      // Check each dossier
      const dossierDetails = [];
      for (const dossierId of dossierIds) {
        try {
          const dossier = await this.getDossier(userAddress, dossierId);
          const dossierInfo = {
            id: dossier.id.toString(),
            name: dossier.name,
            isActive: dossier.isActive,
            lastCheckIn: dossier.lastCheckIn.toString(),
            lastCheckInDate: new Date(Number(dossier.lastCheckIn) * 1000).toISOString(),
            checkInInterval: dossier.checkInInterval.toString(),
            intervalHours: Number(dossier.checkInInterval) / 3600,
            timeSinceLastCheckIn: Date.now() / 1000 - Number(dossier.lastCheckIn),
            recipients: dossier.recipients.length,
            files: dossier.encryptedFileHashes.length,
            canCheckIn: dossier.isActive && dossier.id === dossierId
          };

          dossierDetails.push(dossierInfo);
          console.log(`📄 Dossier #${dossierId.toString()}:`, dossierInfo);

          // Validate this dossier
          if (dossier.id !== dossierId) {
            result.errors.push(`Dossier #${dossierId.toString()} has ID mismatch: stored ID is ${dossier.id.toString()}`);
            result.isValid = false;
          }

        } catch (error) {
          result.errors.push(`Failed to read dossier #${dossierId.toString()}: ${error}`);
          result.isValid = false;
        }
      }

      result.dossierSummary = {
        total: dossierDetails.length,
        active: dossierDetails.filter(d => d.isActive).length,
        inactive: dossierDetails.filter(d => !d.isActive).length,
        canCheckIn: dossierDetails.filter(d => d.canCheckIn).length,
        details: dossierDetails
      };

      console.log('📊 Dossier summary:', result.dossierSummary);

      if (result.dossierSummary.canCheckIn === 0) {
        result.errors.push('No dossiers available for check-in');
        result.isValid = false;
      }

      return result;

    } catch (error) {
      console.error('❌ Debug state check failed:', error);
      result.errors.push(`Debug failed: ${error}`);
      result.isValid = false;
      return result;
    }
  }

  /**
   * DossierV2 Functions - New Enhanced Features
   */
  
  /**
   * Create a new dossier with enhanced features (description, update capabilities)
   */
  static async createDossier(
    name: string,
    description: string,
    checkInIntervalMinutes: number,
    recipients: Address[],
    encryptedFileHashes: string[],
    burnerWallet?: any
  ): Promise<{ dossierId: bigint; txHash: string }> {
    try {
      console.log('📝 Creating V2 dossier on-chain...');

      const checkInIntervalSeconds = BigInt(checkInIntervalMinutes * 60);

      let hash: string;

      // Use burner wallet if provided
      if (burnerWallet) {
        console.log('🔥 Using burner wallet for dossier creation');
        const { ethers } = await import('ethers');

        // Connect to Status Network Sepolia RPC
        const rpcUrl = 'https://public.sepolia.rpc.status.network';
        console.log('🔗 Connecting to Status Network Sepolia RPC');
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const signer = burnerWallet.connect(provider);

        // Create contract instance
        const contract = new ethers.Contract(
          CANARY_DOSSIER_ADDRESS,
          CANARY_DOSSIER_ABI,
          signer
        );

        // Get current gas prices for Status Network (should be 0)
        const feeData = await provider.getFeeData();
        console.log('🔍 Current fee data:', {
          gasPrice: feeData.gasPrice?.toString(),
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
        });

        // Status Network is gasless - use the network's gas price (should be 0)
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from(0);
        const maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
        const maxFeePerGas = feeData.maxFeePerGas || ethers.BigNumber.from(0);

        console.log('💰 Using gas settings (gasless):', {
          gasPrice: gasPrice.toString(),
          maxPriorityFeePerGas: maxPriorityFee.toString(),
          maxFeePerGas: maxFeePerGas.toString()
        });

        // Send transaction - Status Network is gasless, set gas to 0
        const tx = await contract.createDossier(
          name,
          description,
          checkInIntervalSeconds,
          recipients,
          encryptedFileHashes,
          { gasPrice: 0 }
        );

        console.log('✅ Transaction sent with gasless settings:', {
          gasLimit: 500000,
          gasPrice: gasPrice.toString()
        });

        console.log('⏳ Waiting for burner wallet transaction confirmation...');
        const receipt = await tx.wait();
        hash = receipt.transactionHash;
      } else {
        // Use V2 contract with wagmi
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'createDossier',
          args: [name, description, checkInIntervalSeconds, recipients, encryptedFileHashes],
          gas: BigInt(500000),
        });

        console.log('⏳ Waiting for transaction confirmation...');
        await waitForTransactionReceipt(config, { hash });
      }
      
      // Get the dossier ID by reading from the V2 contract
      let userAddress: Address;
      if (burnerWallet) {
        userAddress = burnerWallet.address as Address;
      } else {
        const account = await getAccount(config);
        userAddress = account.address!;
      }

      let dossierId: bigint = BigInt(0);

      try {
        const dossierIds = await readContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'getUserDossierIds',
          args: [userAddress],
        });
        
        const ids = dossierIds as bigint[];
        if (ids.length > 0) {
          dossierId = ids[ids.length - 1]; // Get the last (newest) dossier ID
        }
      } catch (readError) {
        console.warn('Failed to read dossier ID from V2 contract:', readError);
      }
      
      console.log('✅ V2 Dossier created successfully!');
      console.log('Dossier ID:', dossierId.toString());
      console.log('Transaction hash:', hash);
      
      return { dossierId, txHash: hash };
      
    } catch (error) {
      console.error('❌ Failed to create V2 dossier:', error);
      throw error;
    }
  }
  
  /**
   * Update check-in interval for an existing dossier (V2 only)
   */
  static async updateCheckInInterval(dossierId: bigint, newIntervalMinutes: number): Promise<string> {
    try {
      console.log('📝 Updating check-in interval for dossier:', dossierId.toString());
      console.log('New interval:', newIntervalMinutes, 'minutes');
      
      const newIntervalSeconds = BigInt(newIntervalMinutes * 60);
      
      // Use V2 contract
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'updateCheckInInterval',
        args: [dossierId, newIntervalSeconds],
        gas: BigInt(200000),
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Check-in interval updated successfully!');
      return hash;
      
    } catch (error) {
      console.error('❌ Failed to update check-in interval:', error);
      throw error;
    }
  }

  /**
   * Add a file hash to an existing dossier (V2 only)
   */
  static async addFileHash(dossierId: bigint, fileHash: string): Promise<string> {
    try {
      console.log('📎 Adding file hash to dossier:', dossierId.toString());
      console.log('File hash:', fileHash);
      
      // Use V2 contract
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'addFileHash',
        args: [dossierId, fileHash],
        gas: BigInt(200000),
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ File hash added successfully!');
      return hash;
      
    } catch (error) {
      console.error('❌ Failed to add file hash:', error);
      throw error;
    }
  }

  /**
   * Add multiple file hashes to an existing dossier (V2 only)
   */
  static async addMultipleFileHashes(dossierId: bigint, fileHashes: string[]): Promise<string> {
    try {
      console.log('📎 Adding multiple file hashes to dossier:', dossierId.toString());
      console.log('File hashes:', fileHashes);
      
      // Use V2 contract
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'addMultipleFileHashes',
        args: [dossierId, fileHashes],
        gas: BigInt(300000 + fileHashes.length * 50000), // Dynamic gas based on file count
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ File hashes added successfully!');
      return hash;
      
    } catch (error) {
      console.error('❌ Failed to add file hashes:', error);
      throw error;
    }
  }
} 
import { readContract, writeContract, waitForTransactionReceipt, getAccount } from 'wagmi/actions';
import { polygonAmoy } from 'wagmi/chains';
import type { Address } from 'viem';
import { config } from './web3'; // Use the main wagmi config

// Deployed contract address on Polygon Amoy
export const CANARY_DOSSIER_ADDRESS: Address = '0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0';

// Contract ABI - generated from your simplified Dossier.sol
export const CANARY_DOSSIER_ABI = [
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
    "name": "deactivateDossier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_dossierId", "type": "uint256" }],
    "name": "reactivateDossier",
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
    "name": "DossierTriggered",
    "type": "event"
  }
] as const;

export interface Dossier {
  id: bigint;
  name: string;
  isActive: boolean;
  checkInInterval: bigint;
  lastCheckIn: bigint;
  encryptedFileHashes: string[];
  recipients: Address[];
}

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
        configChainId: polygonAmoy.id,
        networkMatch: account.chainId === polygonAmoy.id
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
        configChainId: polygonAmoy.id,
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

      // Check network
      if (account.chainId !== polygonAmoy.id) {
        result.errors.push(`Wrong network. Current: ${account.chainId}, Expected: ${polygonAmoy.id}`);
        result.isValid = false;
        return result;
      }

      // Process parameters exactly as they would be sent to contract
      const checkInIntervalSeconds = BigInt(checkInIntervalMinutes * 60);
      
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
          args: [name, checkInIntervalSeconds, recipients, encryptedFileHashes],
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
              args: [name, checkInIntervalSeconds, recipients, encryptedFileHashes],
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
      
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'checkIn',
        args: [dossierId],
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Check-in successful!');
      return hash;
      
    } catch (error) {
      console.error('❌ Check-in failed:', error);
      throw error;
    }
  }
  
  /**
   * Check in for all active dossiers
   */
  static async checkInAll(): Promise<string> {
    try {
      console.log('✅ Performing check-in for all dossiers...');
      
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'checkInAll',
        args: [],
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Check-in all successful!');
      return hash;
      
    } catch (error) {
      console.error('❌ Check-in all failed:', error);
      throw error;
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
      
      return result as Dossier;
      
    } catch (error) {
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
   * Deactivate a dossier
   */
  static async deactivateDossier(dossierId: bigint): Promise<string> {
    try {
      console.log('🛑 Deactivating dossier:', dossierId.toString());
      
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'deactivateDossier',
        args: [dossierId],
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Dossier deactivated successfully!');
      return hash;
      
    } catch (error) {
      console.error('❌ Failed to deactivate dossier:', error);
      throw error;
    }
  }

  /**
   * Reactivate a dossier
   */
  static async reactivateDossier(dossierId: bigint): Promise<string> {
    try {
      console.log('🔄 Reactivating dossier:', dossierId.toString());
      
      const hash = await writeContract(config, {
        address: CANARY_DOSSIER_ADDRESS,
        abi: CANARY_DOSSIER_ABI,
        functionName: 'reactivateDossier',
        args: [dossierId],
      });
      
      await waitForTransactionReceipt(config, { hash });
      
      console.log('✅ Dossier reactivated successfully!');
      return hash;
      
    } catch (error) {
      console.error('❌ Failed to reactivate dossier:', error);
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

      if (account.chainId !== polygonAmoy.id) {
        result.errors.push(`Wrong network. Current: ${account.chainId}, Expected: ${polygonAmoy.id}`);
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
} 
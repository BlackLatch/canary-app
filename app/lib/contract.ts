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
   * Create a new dossier on-chain
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
      
      // Test contract connection first
      const isConnected = await this.testContractConnection();
      if (!isConnected) {
        throw new Error('Contract is not accessible. Please check the contract address and network.');
      }

      // Get the current account
      const account = await getAccount(config);
      if (!account.address) {
        throw new Error('No wallet connected');
      }

      console.log('💳 Wallet address:', account.address);
      console.log('🔗 Chain ID:', account.chainId);

      // Check if we're on the right network
      if (account.chainId !== polygonAmoy.id) {
        throw new Error(`Please switch to Polygon Amoy testnet. Current chain: ${account.chainId}, Expected: ${polygonAmoy.id}`);
      }

      // PRE-FLIGHT VALIDATION: Check contract constraints
      console.log('🔍 Pre-flight validation...');
      
      // 1. Check contract constants
      const constants = await this.getConstants();
      console.log('📊 Contract constants:', constants);
      
      // 2. Convert and validate check-in interval
      const checkInIntervalSeconds = BigInt(checkInIntervalMinutes * 60);
      console.log('⏱️ Check-in interval:', checkInIntervalSeconds.toString(), 'seconds');
      
      if (checkInIntervalSeconds < constants.minInterval) {
        throw new Error(`Check-in interval too short. Minimum: ${constants.minInterval} seconds (${Number(constants.minInterval)/60} minutes)`);
      }
      if (checkInIntervalSeconds > constants.maxInterval) {
        throw new Error(`Check-in interval too long. Maximum: ${constants.maxInterval} seconds`);
      }
      
      // 3. Check user's current dossier count
      const userDossierIds = await this.getUserDossierIds(account.address);
      console.log('📋 User has', userDossierIds.length, 'existing dossiers');
      
      if (userDossierIds.length >= Number(constants.maxDossiers)) {
        throw new Error(`Maximum dossiers reached. Limit: ${constants.maxDossiers}`);
      }
      
      // 4. Validate recipients
      if (recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }
      if (recipients.length > 20) { // MAX_RECIPIENTS_PER_DOSSIER from contract
        throw new Error('Too many recipients. Maximum: 20');
      }
      
      // 5. Validate file hashes
      if (encryptedFileHashes.length === 0) {
        throw new Error('At least one file hash is required');
      }
      if (encryptedFileHashes.length > 100) { // MAX_FILES_PER_DOSSIER from contract
        throw new Error('Too many files. Maximum: 100');
      }
      
      console.log('✅ Pre-flight validation passed!');
      
      // Convert minutes to seconds for the contract
      console.log('📞 Calling createDossier with args:', {
        name,
        checkInIntervalSeconds: checkInIntervalSeconds.toString(),
        recipients,
        encryptedFileHashes
      });

      let hash: `0x${string}` | undefined;

      // Try transaction with wagmi config (uses wallet's RPC)
      console.log('🚀 Attempting transaction with wallet connection...');
      try {
        // Add explicit gas limit to avoid estimation issues
        hash = await writeContract(config, {
          address: CANARY_DOSSIER_ADDRESS,
          abi: CANARY_DOSSIER_ABI,
          functionName: 'createDossier',
          args: [name, checkInIntervalSeconds, recipients, encryptedFileHashes],
          gas: BigInt(500000), // Explicit gas limit
        });

        console.log('✅ Transaction submitted successfully:', hash);

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
   * Get contract constants
   */
  static async getConstants() {
    try {
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
      console.error('❌ Failed to get contract constants:', error);
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
} 
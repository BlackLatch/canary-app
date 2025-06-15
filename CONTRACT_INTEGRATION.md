# Contract Integration - Canary Frontend

## 🎯 Overview

The Canary frontend is now fully integrated with the deployed **CanaryDossier** smart contract on Sepolia testnet.

## 📍 Contract Details

- **Address**: `0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0`
- **Network**: Sepolia Testnet
- **Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0)

## ✨ Integration Features

### 🔗 **Integrated Upload Process**
- **Step 1**: Encrypt file with TACo threshold cryptography
- **Step 2**: Upload to decentralized storage (Codex/IPFS/Pinata)
- **Step 3**: Create dossier on-chain with file hashes and recipients
- **Result**: Both storage commitment AND blockchain record

### 📋 **On-Chain Dossier Management**
- Create dossiers with encrypted file hashes
- Set check-in intervals (1 minute to 30 days)
- Define recipients for each dossier
- View all user dossiers from contract

### ✅ **Smart Check-ins**
- Local check-in recording (immediate UI update)
- On-chain check-in via contract (when wallet connected)
- Bulk check-in for all active dossiers
- Automatic contract sync

### 📊 **Contract Status Display**
- Real-time contract connection indicator
- Dossier creation status in upload history
- Transaction hash links to Etherscan
- Contract address link in header

## 🔧 Technical Architecture

### **Files**
- `app/lib/contract.ts` - Contract ABI, address, and service methods
- `app/page.tsx` - Frontend integration with contract calls
- `deployed_address.txt` - Contract deployment record

### **Key Functions**
```typescript
// Create dossier on-chain
ContractService.createDossier(name, intervalMinutes, recipients, fileHashes)

// Check in for all dossiers
ContractService.checkInAll()

// Load user's dossiers
ContractService.getUserDossierIds(address)
ContractService.getDossier(address, dossierId)

// Check encryption status
ContractService.shouldDossierStayEncrypted(address, dossierId)
```

## 📱 User Experience

### **With Wallet Connected (Full Experience)**
1. Connect Web3 wallet (MetaMask/Coinbase/WalletConnect)
2. Upload → Creates storage commitment + on-chain dossier
3. Check-in → Updates both local UI + blockchain state
4. View dossiers → Shows both upload history + on-chain records

### **Demo Mode (Storage Only)**
1. File encryption with TACo threshold cryptography
2. Storage upload to Codex/IPFS/Pinata
3. Local check-in simulation
4. No blockchain interaction

## 🎮 Testing

### **Prerequisites**
- Web3 wallet with Sepolia ETH
- Sepolia testnet in wallet

### **Test Flow**
1. Connect wallet → See "Sepolia Contract" indicator
2. Upload file → See "Upload + Create Dossier" button
3. Monitor console → Contract deployment logs
4. Check uploads table → See dossier ID and transaction hash
5. Perform check-in → Triggers on-chain transaction
6. View on-chain dossiers → Real contract data

## 🔍 Contract Verification

Visit [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0) to:
- View contract source code
- Monitor dossier creation events
- Track check-in transactions
- Verify user interactions

## 🚀 What's Next

The integration provides a complete Web3 + decentralized storage solution:
- ✅ Real TACo threshold cryptography
- ✅ Multi-backend storage (Codex/IPFS/Pinata)
- ✅ Smart contract dossier management
- ✅ On-chain check-in system
- ✅ User-friendly Web3 UX

Users can now create cryptographically protected dossiers with both storage redundancy and blockchain verification! 
# Smart Contract Update Guide

## Overview
This guide explains how to deploy the updated smart contract (DossierV2) and integrate it with the frontend.

## New Features in DossierV2

### 1. Update Check-in Interval
- Function: `updateCheckInInterval(uint256 _dossierId, uint256 _newInterval)`
- Allows users to modify the check-in schedule for active dossiers
- Validates interval is within allowed range (1 hour to 30 days)

### 2. Add Files to Existing Dossier
- Function: `addFileHash(uint256 _dossierId, string memory _fileHash)`
- Function: `addMultipleFileHashes(uint256 _dossierId, string[] memory _fileHashes)`
- Allows adding encrypted files to an existing dossier
- Maximum 100 files per dossier

### 3. Manage Recipients
- Function: `addRecipient(uint256 _dossierId, address _recipient)`
- Function: `removeRecipient(uint256 _dossierId, address _recipient)`
- Allows modifying who can decrypt the dossier after release

## Deployment Steps

### 1. Deploy the New Contract

```bash
cd scripts
python deploy_v2.py
```

### 2. Update Environment Variables

Update `.env` with the new contract address:
```
NEXT_PUBLIC_POLYGON_AMOY_CONTRACT_ADDRESS_V2=<new_contract_address>
```

### 3. Update Contract ABI

The new ABI needs to be added to `/app/lib/contract.ts`. The main additions are:

```javascript
// New function signatures to add to CANARY_DOSSIER_ABI
{
  "inputs": [
    { "internalType": "uint256", "name": "_dossierId", "type": "uint256" },
    { "internalType": "uint256", "name": "_newInterval", "type": "uint256" }
  ],
  "name": "updateCheckInInterval",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
{
  "inputs": [
    { "internalType": "uint256", "name": "_dossierId", "type": "uint256" },
    { "internalType": "string", "name": "_fileHash", "type": "string" }
  ],
  "name": "addFileHash",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
{
  "inputs": [
    { "internalType": "uint256", "name": "_dossierId", "type": "uint256" },
    { "internalType": "string[]", "name": "_fileHashes", "type": "string[]" }
  ],
  "name": "addMultipleFileHashes",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

## Frontend Integration

### Update ContractService

Add these methods to `/app/lib/contract.ts`:

```typescript
// Update check-in interval
static async updateCheckInInterval(
  dossierId: bigint,
  newInterval: bigint
): Promise<string> {
  await ensureCorrectNetwork();
  
  const hash = await writeContract(config, {
    address: CANARY_DOSSIER_ADDRESS,
    abi: CANARY_DOSSIER_ABI,
    functionName: 'updateCheckInInterval',
    args: [dossierId, newInterval],
    chain: polygonAmoy
  });
  
  const receipt = await waitForTransactionReceipt(config, { hash });
  return receipt.transactionHash;
}

// Add file hash to dossier
static async addFileHash(
  dossierId: bigint,
  fileHash: string
): Promise<string> {
  await ensureCorrectNetwork();
  
  const hash = await writeContract(config, {
    address: CANARY_DOSSIER_ADDRESS,
    abi: CANARY_DOSSIER_ABI,
    functionName: 'addFileHash',
    args: [dossierId, fileHash],
    chain: polygonAmoy
  });
  
  const receipt = await waitForTransactionReceipt(config, { hash });
  return receipt.transactionHash;
}

// Add multiple file hashes
static async addMultipleFileHashes(
  dossierId: bigint,
  fileHashes: string[]
): Promise<string> {
  await ensureCorrectNetwork();
  
  const hash = await writeContract(config, {
    address: CANARY_DOSSIER_ADDRESS,
    abi: CANARY_DOSSIER_ABI,
    functionName: 'addMultipleFileHashes',
    args: [dossierId, fileHashes],
    chain: polygonAmoy
  });
  
  const receipt = await waitForTransactionReceipt(config, { hash });
  return receipt.transactionHash;
}
```

### Update UI Components

The UI components in `/app/page.tsx` are already set up with modals for:
1. Edit Schedule - needs to call `ContractService.updateCheckInInterval()`
2. Add Files - needs to call `ContractService.addFileHash()` or `ContractService.addMultipleFileHashes()`

## Testing

### Manual Testing Steps

1. **Test Schedule Update:**
   - Create a dossier with 1 hour check-in interval
   - Click "Edit Schedule" button
   - Change to 1 day interval
   - Verify transaction succeeds
   - Reload and confirm new interval is displayed

2. **Test Adding Files:**
   - Create a dossier with one file
   - Click "Add Files" button
   - Select and upload additional files
   - Verify files are encrypted and added
   - Reload and confirm all files are listed

### Contract Tests

Create test file `test/DossierV2.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DossierV2", function () {
  let contract;
  let owner;
  let addr1;

  beforeEach(async function () {
    const DossierV2 = await ethers.getContractFactory("CanaryDossierV2");
    contract = await DossierV2.deploy();
    await contract.deployed();
    [owner, addr1] = await ethers.getSigners();
  });

  describe("Update Features", function () {
    it("Should update check-in interval", async function () {
      // Create dossier
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600, // 1 hour
        [addr1.address],
        ["ipfs://test"]
      );

      // Update interval
      await contract.updateCheckInInterval(0, 7200); // 2 hours
      
      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.checkInInterval).to.equal(7200);
    });

    it("Should add file hash", async function () {
      // Create dossier
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://file1"]
      );

      // Add file
      await contract.addFileHash(0, "ipfs://file2");
      
      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(2);
      expect(dossier.encryptedFileHashes[1]).to.equal("ipfs://file2");
    });
  });
});
```

## Migration Checklist

- [ ] Deploy DossierV2 contract to Polygon Amoy
- [ ] Update contract address in environment variables
- [ ] Add new ABI functions to contract.ts
- [ ] Implement ContractService methods
- [ ] Update frontend modal handlers to call new methods
- [ ] Test schedule update functionality
- [ ] Test file addition functionality
- [ ] Run contract tests
- [ ] Document new contract address

## Notes

- The contract maintains backward compatibility
- Existing dossiers will work with the new contract
- Only active, non-released, non-disabled dossiers can be updated
- All updates emit events for tracking
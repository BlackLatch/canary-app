# ABI Mismatch Issue - Fix Instructions

## Problem

The application is experiencing ABI mismatch errors when trying to read dossiers from the deployed contract:

```
❌ Bytes value "14,16" is not a valid boolean
❌ Position out of bounds
```

This means the deployed smart contract's structure does not match the ABI file in `app/lib/dossierV2.abi.json`.

## Current Configuration

- **Contract Address**: `0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0` (Status Network Sepolia)
- **ABI File**: `app/lib/dossierV2.abi.json` (last modified: Aug 28)
- **Environment Variable**: `NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS`

## Solution Options

### Option 1: Update the ABI (Recommended)

If the deployed contract is the correct one:

1. Go to the standalone contracts repository
2. Find the deployed contract source
3. Compile and export the ABI
4. Replace `app/lib/dossierV2.abi.json` with the correct ABI
5. Restart the app

```bash
# Example: if using Hardhat
cd /path/to/contracts-repo
npx hardhat compile
cp artifacts/contracts/DossierV2.sol/DossierV2.json /path/to/canary/app/lib/dossierV2.abi.json
```

### Option 2: Update the Contract Address

If you have a different deployment that matches the current ABI:

1. Update `.env.local`:
   ```
   NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS=0xYourCorrectContractAddress
   ```
2. Restart the app

### Option 3: Redeploy the Contract

If the ABI is correct and the contract needs to be redeployed:

1. Deploy the contract from the source that matches `dossierV2.abi.json`
2. Update the contract address in `.env.local`
3. Restart the app

## Verification

After applying the fix, you can verify it works by:

1. Checking the browser console for the debug output
2. Looking for: `✅ Loaded X dossiers with accurate decryptable status`
3. No more ABI mismatch errors

## Technical Details

The ABI expects the `getDossier` function to return a struct with these boolean fields:
- `isActive` (bool)
- `isPermanentlyDisabled` (bool)
- `isReleased` (bool)

The deployed contract is returning data that cannot be decoded as proper booleans, indicating a struct mismatch.

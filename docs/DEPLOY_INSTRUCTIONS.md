# 🚀 DossierV2 Contract Deployment Instructions

## Prerequisites

### 1. Set up Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and add:
```env
# Your wallet private key (DO NOT COMMIT!)
PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC URL (otherwise uses Alchemy from .env.local)
POLYGON_AMOY_RPC_URL=
```

### 2. Get Test MATIC

1. Go to https://faucet.polygon.technology/
2. Select "Polygon Amoy" network
3. Enter your wallet address
4. Request test MATIC (you'll need at least 0.1 MATIC for deployment)

### 3. Get Alchemy API Key (if not already set)

1. Go to https://www.alchemy.com/
2. Sign up for a free account
3. Create a new app for Polygon Amoy
4. Copy your API key
5. Add to `.env.local`:
```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
```

## Deployment Options

### Option 1: Using Hardhat (Recommended)

```bash
# Install dependencies if not already installed
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Compile the contract
npx hardhat compile

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### Option 2: Using Remix IDE (Easy Alternative)

1. Go to https://remix.ethereum.org/
2. Create a new file: `DossierV2.sol`
3. Copy the contents from `contracts/DossierV2.sol`
4. Compile with Solidity 0.8.19
5. In Deploy tab:
   - Select "Injected Provider - MetaMask"
   - Make sure MetaMask is on Polygon Amoy network
   - Click "Deploy"
   - Copy the deployed contract address

### Option 3: Manual Deployment Script

Create `scripts/simple-deploy.mjs`:

```javascript
import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function deploy() {
  // Connect to Polygon Amoy
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL || 
    `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // Setup wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log('Deploying from:', wallet.address);
  
  // Read compiled contract
  const contractJson = JSON.parse(
    fs.readFileSync('./artifacts/contracts/DossierV2.sol/CanaryDossierV2.json', 'utf8')
  );
  
  // Deploy
  const factory = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet
  );
  
  console.log('Deploying...');
  const contract = await factory.deploy();
  await contract.deployed();
  
  console.log('Contract deployed to:', contract.address);
  console.log('Transaction hash:', contract.deployTransaction.hash);
  
  // Save address to .env.local
  let envContent = fs.readFileSync('.env.local', 'utf8');
  envContent += `\n\n# DossierV2 Contract\nNEXT_PUBLIC_CANARY_DOSSIER_V2_ADDRESS=${contract.address}\n`;
  fs.writeFileSync('.env.local', envContent);
  
  console.log('✅ Deployment complete!');
}

deploy().catch(console.error);
```

Then run:
```bash
node scripts/simple-deploy.mjs
```

## After Deployment

### 1. Update Frontend

Add the new contract address to `.env.local`:
```env
NEXT_PUBLIC_CANARY_DOSSIER_V2_ADDRESS=0x_your_deployed_contract_address
```

### 2. Update Contract Service

In `app/lib/contract.ts`, add:

```typescript
// New contract address
export const CANARY_DOSSIER_V2_ADDRESS: Address = 
  process.env.NEXT_PUBLIC_CANARY_DOSSIER_V2_ADDRESS as Address;

// Add new ABI methods
export const CANARY_DOSSIER_V2_ABI = [
  // ... existing ABI ...
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
  }
  // ... more methods
];
```

### 3. Verify Contract (Optional)

```bash
npx hardhat verify --network polygonAmoy YOUR_CONTRACT_ADDRESS
```

Or manually on PolygonScan:
1. Go to https://www.oklink.com/amoy/address/YOUR_CONTRACT_ADDRESS
2. Click "Verify and Publish"
3. Select Solidity 0.8.19, MIT License
4. Paste contract source code

### 4. Test the Deployment

Run the test suite against the deployed contract:

```bash
# Set the contract address in tests
export DOSSIER_V2_ADDRESS=YOUR_CONTRACT_ADDRESS

# Run tests
npx hardhat test --network polygonAmoy
```

## Troubleshooting

### Issue: "Insufficient funds"
- Make sure you have test MATIC from the faucet
- Check your wallet address is correct

### Issue: "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Try `npm install --save-dev hardhat ethers`

### Issue: Node.js version warning
- Hardhat works best with Node.js LTS versions (18.x or 20.x)
- Consider using nvm to manage Node versions

### Issue: Transaction fails
- Check gas price: might need to increase
- Verify you're on the correct network (Polygon Amoy)
- Ensure contract compiles without errors

## Contract Addresses

### Polygon Amoy (Testnet)
- Current V1: `0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0`
- V2: `[To be deployed]`

### Important Links
- Polygon Amoy Faucet: https://faucet.polygon.technology/
- Polygon Amoy Explorer: https://www.oklink.com/amoy
- Alchemy Dashboard: https://dashboard.alchemy.com/
- Remix IDE: https://remix.ethereum.org/

## Security Notes

⚠️ **NEVER commit your private key to git**
⚠️ **Always use a separate wallet for development**
⚠️ **Test thoroughly on testnet before mainnet**

## Need Help?

1. Check the deployment logs for errors
2. Verify network connectivity
3. Ensure sufficient balance
4. Review contract compilation output
5. Check transaction on block explorer

Happy deploying! 🚀
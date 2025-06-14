# Sepolia Deployment Guide

## 🛠️ Prerequisites

1. **Infura Account & Project ID**
   - Sign up at [infura.io](https://infura.io)
   - Create a new project
   - Copy your **Project ID** from the dashboard

2. **Funded Account**
   - Ensure your `canary` account has Sepolia ETH
   - Get free Sepolia ETH from faucets:
     - [Sepolia Faucet](https://sepoliafaucet.com/)
     - [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

## 🚀 Deploy Command

Replace `YOUR_ACTUAL_PROJECT_ID` with your Infura Project ID:

```bash
export WEB3_INFURA_PROJECT_ID=YOUR_ACTUAL_PROJECT_ID && \
source venv/bin/activate && \
python scripts/deploy_interactive.py --network ethereum:sepolia --account canary
```

## 📋 What Happens During Deployment

1. **Network Connection**: Connects to Sepolia via Infura
2. **Account Loading**: Loads your `canary` account  
3. **Balance Check**: Shows your current Sepolia ETH balance
4. **Contract Deployment**: Deploys CanaryDossier contract
5. **Verification**: Tests basic contract functions
6. **Address Saving**: Saves contract address to `deployed_address.txt`

## ✅ Expected Output

```
🌐 Selected network: ethereum:sepolia
🔗 Connected to infura
📝 Deploying from: 0x60646c03b1576E75539b64352C18F1230F99EEa3
💰 Balance: 0.1234 ETH

🚀 Deploying CanaryDossier...
✅ Deployment successful!
📍 Contract address: 0x1234567890abcdef...
🔗 Transaction hash: 0xabcdef1234567890...

🧪 Testing contract...
MIN_CHECK_IN_INTERVAL: 1.0 hours
MAX_CHECK_IN_INTERVAL: 30.0 days
GRACE_PERIOD: 1.0 hours
MAX_DOSSIERS_PER_USER: 50

📄 Contract address saved to deployed_address.txt
```

## 🔍 Verify Deployment

After deployment, you can verify your contract on [Sepolia Etherscan](https://sepolia.etherscan.io) using the contract address.

## 🆘 Troubleshooting

- **"Unauthorized" error**: Check your Infura Project ID
- **"Insufficient funds"**: Get more Sepolia ETH from faucets
- **"Account not found"**: Ensure `canary` account exists in ape accounts 
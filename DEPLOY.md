# Canary Dossier Deployment

Simple eth-ape deployment setup for the CanaryDossier smart contract.

## Setup

1. **Install eth-ape and dependencies:**
```bash
pip install -r requirements.txt
```

2. **Configure your API keys in `ape-config.yaml`:**
   - Replace `YOUR_API_KEY` with your Alchemy API key
   - Or configure other providers as needed

3. **Set up accounts:**
```bash
# Add an account for mainnet/testnet deployment
ape accounts import my-account

# Or use the test accounts for local testing
```

## Deployment

### Local Testing
```bash
# Deploy to local test network
ape run deploy

# Or use the interactive script
python scripts/deploy_interactive.py
```

### Testnet Deployment
```bash
# Deploy to Sepolia testnet
python scripts/deploy_interactive.py --network ethereum:sepolia --account my-account
```

### Mainnet Deployment
```bash
# Deploy to mainnet (BE CAREFUL!)
python scripts/deploy_interactive.py --network ethereum:mainnet --account my-account
```

## Contract Features

The deployed CanaryDossier contract supports:
- ✅ Create dossiers with files and recipients
- ✅ Check-in functionality (individual or all dossiers)
- ✅ TACo encryption integration
- ✅ Deactivate/reactivate dossiers
- ✅ Basic getter functions

## Files

- `contracts/Dossier.sol` - The smart contract
- `scripts/deploy.py` - Simple deployment script
- `scripts/deploy_interactive.py` - Interactive deployment with options
- `ape-config.yaml` - Ape framework configuration
- `deployed_address.txt` - Contract address (created after deployment) 
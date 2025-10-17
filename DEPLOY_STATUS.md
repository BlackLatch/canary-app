# Deploying to Status Network

This guide covers deploying the CanaryDossierV2 contract to Status Network Sepolia testnet.

## Why Status Network?

- **Gasless Transactions**: Users don't pay gas fees (RLN rate-limiting instead)
- **Perfect for Burner Wallets**: No need to fund wallets with testnet tokens
- **zkEVM**: Built on Linea for security and scalability
- **Rate Limits**: 10 requests/second, 100k requests/day

## Network Details

- **Name**: Status Network Sepolia Testnet
- **RPC URL**: `https://public.sepolia.rpc.status.network`
- **Chain ID**: `1660990954`
- **Explorer**: https://sepoliascan.status.network
- **Faucet**: https://faucet.status.network
- **Bridge**: https://bridge.status.network

## Getting Testnet ETH

### Deployer Address
```
0x60646c03b1576E75539b64352C18F1230F99EEa3
```

### Option 1: Status Network Faucet (Recommended)
1. Visit https://faucet.status.network
2. Connect your wallet (must have the above private key imported)
3. Click "Request Funds"
4. Receive 0.01 ETH (limit: 1 request per address per day)

### Option 2: Bridge from Sepolia
If the faucet doesn't work:

1. **Get Sepolia ETH**:
   - Alchemy Faucet: https://www.alchemy.com/faucets/ethereum-sepolia
   - MetaMask Faucet: https://docs.metamask.io/developer-tools/faucet/

2. **Bridge to Status Network**:
   - Visit https://bridge.status.network
   - Connect your wallet with Sepolia ETH
   - Bridge to Status Network testnet
   - Wait for confirmation

## Deployment Steps

### 1. Compile the Contract
```bash
node compile-contract.js
```

This creates the contract artifacts needed for deployment.

### 2. Deploy to Status Network
Once you have testnet ETH at the deployer address:

```bash
node deploy-status-manual.js
```

### 3. Verify Deployment
The script will:
- ✅ Deploy the CanaryDossierV2 contract
- ✅ Save deployment info to `deployments/DossierV2_statusSepolia_*.json`
- ✅ Update `.env.local` with `NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS`
- ✅ Display contract address and explorer link

## Post-Deployment

### View on Explorer
Your contract will be visible at:
```
https://sepoliascan.status.network/address/YOUR_CONTRACT_ADDRESS
```

### Update Frontend
The deployment script automatically updates `.env.local` with:
```
NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS=0x...
```

You'll need to:
1. Add Status Network to wagmi config
2. Update contract service to support Status Network
3. Test gasless transactions with burner wallets

## Troubleshooting

### "No ETH balance" Error
- Check balance at: https://sepoliascan.status.network/address/0x60646c03b1576E75539b64352C18F1230F99EEa3
- Try the faucet again (1 request per day limit)
- Use the bridge method if faucet fails

### Faucet Not Working
- Join Telegram for support: https://t.me/statusl2
- Try alternative: Bridge from Sepolia ETH

### RPC Rate Limiting
If you hit rate limits (10 rps / 100k requests per day):
- Wait and retry
- Consider running your own Status Network node (see Status docs)

## Next Steps

After successful deployment:
1. [ ] Add Status Network chain configuration to `app/lib/chains.ts`
2. [ ] Update wagmi config to include Status Network
3. [ ] Add network switcher in UI for Status Network
4. [ ] Test burner wallet with gasless transactions
5. [ ] Deploy to production when ready

## Resources

- **Status Network Docs**: https://docs.status.network
- **Telegram Community**: https://t.me/statusl2
- **GitHub**: https://github.com/status-im
- **Faucet Contract**: `0x06338B70F1eAbc60d7A82C083e605C07F78bb878`

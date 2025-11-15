# Canary

**Dead man's switch for encrypted files. Your silence becomes the trigger.**

Canary lets you encrypt files that auto-release when you stop checking in. Built for journalists, activists, developers, and anyone who needs cryptographic insurance that their data gets out if something happens to them.

---

## What It Does

1. **Encrypt files** with threshold cryptography (TACo)
2. **Set a check-in interval** (hourly, daily, weekly, monthly)
3. **Check in regularly** to prove you're still in control
4. **Miss check-ins** → files auto-release to the public or specific recipients

No servers. No trust required. All client-side. Fully decentralized.

---

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **PWA** - Offline-first progressive web app
- **Privy** - Embedded wallet auth (supports email, social, passkey)
- **wagmi + viem** - Ethereum wallet interactions

### Crypto & Blockchain
- **TACo (Threshold Access Control)** - Threshold encryption via NuCypher
  - Ritual ID 27 on Lynx devnet
  - Polygon Amoy (chain ID 80002) for infrastructure
- **Smart Contracts** - Solidity on Status Network Sepolia (gasless)
  - `Dossier.sol` - Core contract for dossier management
  - Supports ERC-4337 account abstraction (gasless transactions)
- **Ethers.js** - Contract interactions
- **SIWE (EIP-4361)** - Sign-In with Ethereum for auth

### Storage
- **IPFS** - Decentralized file storage
  - Pinata for pinning
  - Codex integration (optional local storage)
- **MessageKit** - Encrypted file containers

### Key Features
- **Burner Wallets** - Local, ephemeral in-browser wallets
- **Compound Conditions** - Contract + recipient verification for private dossiers
- **URL-based Routing** - Shareable permalinks for dossiers
- **Dual Auth Modes**:
  - Standard: Email/social login with embedded smart wallet (gasless)
  - Advanced: Web3 wallet or burner wallet connection

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/BlackLatch/canary-app.git
cd canary-app
npm install

# Run development server (no setup needed!)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**That's it.** The app has hardcoded API keys for Pinata and Privy for development. Just clone and run.

---

## Configuration (Optional)

The app works out-of-the-box with hardcoded dev API keys. If you want to use your own:

```bash
# Optional - only if you want your own API keys
cp .env.example .env.local
# Edit .env.local with your keys
```

```bash
# Optional API keys
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
NEXT_PUBLIC_CODEX_API_URL=http://localhost:8080  # For local Codex
```

### Getting Your Own API Keys (Optional)

- **Privy**: [privy.io](https://privy.io) - Embedded wallet provider
- **Pinata**: [pinata.cloud](https://pinata.cloud) - IPFS pinning service
- **WalletConnect**: [walletconnect.com](https://walletconnect.com) - Optional

---

## Project Structure

```
canary/
├── app/
│   ├── page.tsx                 # Main app (check-in, dossiers, monitor, share)
│   ├── release/page.tsx         # Dossier detail permalink page
│   ├── feed/page.tsx            # Public releases feed
│   ├── lib/
│   │   ├── contract.ts          # Smart contract interactions
│   │   ├── taco.ts              # TACo encryption/decryption
│   │   ├── burner-wallet.ts     # Local wallet management
│   │   ├── pinata.ts            # IPFS pinning service
│   │   └── chains/              # Chain configurations
│   └── components/
│       ├── DossierDetailView.tsx  # Reusable dossier UI
│       ├── MediaRecorder.tsx      # Voice/video recording
│       └── ...
├── contracts/                   # Solidity contracts
│   └── Dossier.sol
├── public/
└── package.json
```

---

## How It Works

### Creating a Dossier

1. **Upload files** - Drag & drop or select files
2. **Choose release mode**:
   - Public: Anyone can decrypt after trigger
   - Private: Only specific addresses can decrypt
3. **Set check-in interval** - How often you need to prove you're alive
4. **Encrypt & deploy**:
   - Files encrypted with TACo (threshold encryption)
   - Uploaded to IPFS (Pinata + Codex)
   - Dossier created on-chain (Status Network Sepolia)

### The Check-In Loop

- Contract tracks `lastCheckIn` timestamp
- If `currentTime - lastCheckIn > interval` → dossier is expired
- Expired dossiers become decryptable
- Anyone can decrypt expired public dossiers
- Only designated recipients can decrypt private dossiers

### TACo Encryption Flow

```
1. Create conditions (contract check + optional recipient check)
2. Encrypt files with TACo threshold encryption
3. Store encrypted MessageKit on IPFS
4. Contract stores IPFS hash
5. On expiry: TACo nodes verify conditions and allow decryption
```

### URL Structure

- `/?user={address}` - View user's dossier list (also used for sharing)
- `/?user={address}&id={id}` - View specific dossier detail
- `/release?user={address}&id={id}` - Alternative permalink (legacy)
- `/feed` - Public releases feed

---

## Contributing

### Development Workflow

1. **Find an issue** or create one
2. **Fork the repo** and create a branch
3. **Make changes** - Keep commits focused
4. **Test locally** - Ensure app builds and functions
5. **Submit PR** - Reference the issue

### Code Style

- TypeScript for type safety
- Use existing patterns (hooks, components, utilities)
- Keep functions small and focused
- Comment complex crypto/contract logic
- Test with both auth modes (standard & advanced)

### Key Files to Understand

- `app/lib/contract.ts` - All smart contract interactions
- `app/lib/taco.ts` - TACo encryption/decryption logic
- `app/page.tsx` - Main app state and UI flow
- `contracts/Dossier.sol` - On-chain dossier storage

### Testing Checklist

- [ ] Standard auth mode (email/social login)
- [ ] Advanced auth mode (Web3/burner wallet)
- [ ] Create public dossier
- [ ] Create private dossier
- [ ] Check-in functionality
- [ ] Decrypt expired dossier
- [ ] Share links work while logged out
- [ ] PWA installs and works offline

---

## Smart Contract

**Deployed on Status Network Sepolia** (gasless blockchain)

Contract: [`Dossier.sol`](./contracts/Dossier.sol)

Key functions:
- `createDossier()` - Create new dossier
- `checkIn()` - Prove you're alive
- `pauseOrResume()` - Pause/resume dossier
- `getDossier()` - Fetch dossier data
- `getUserDossierIds()` - Get all dossiers for address

---

## Security Notes

- **Threshold encryption**: No single party can decrypt your files
- **Client-side only**: All encryption happens in your browser
- **No backend**: Can't be shut down by taking down a server
- **Open source**: Audit the code yourself
- **Gasless transactions**: Uses ERC-4337 for free transactions

### Known Limitations

- TACo is in alpha (Lynx devnet)
- IPFS retrieval depends on pinning services
- Browser IndexedDB for local state (clear data = lose burner wallet)
- Check-in timing is not atomic (relies on block timestamps)

---

## Build & Deploy

```bash
# Production build
npm run build

# Export static site
npm run export

# Deploy to any static host (Vercel, Netlify, IPFS, etc.)
```

---

## License

MIT License - See [LICENSE](./LICENSE)

---

## Links

- **Live Demo**: [Coming Soon]
- **Contracts**: [contracts/](./contracts/)
- **Issues**: [GitHub Issues](https://github.com/BlackLatch/canary-app/issues)

---

## Support

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Read the code - it's the best documentation

**Remember: This is alpha software. Use at your own risk. Test thoroughly before trusting it with sensitive data.**

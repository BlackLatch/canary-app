# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canary is a decentralized deadman switch application for journalists and whistleblowers. It enables conditional release of encrypted files based on various triggers (inactivity, location, keywords). Built with Next.js 15, React 19, and Web3 technologies.

## Commands

### Development
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build           # Build for production (static export)
npm run start           # Start production server
npm run lint            # Run ESLint
npm run deploy          # Deploy to production
```

### Testing
```bash
npm test                 # Run all tests
npm run test:ui         # Run tests with UI interface
npm run test:coverage   # Run tests with coverage report
```

### Contract Deployment
```bash
cd scripts
python deploy.py        # Deploy smart contracts
```

## Architecture

### Core Technologies
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, "E-Reader Futurism" design system
- **Authentication**: Privy (email auth, embedded wallets)
- **Blockchain**: Ethereum/Polygon, ethers.js, wagmi, viem
- **Encryption**: TACo (Threshold Access Control)
- **Storage**: IPFS (Helia), Pinata, Codex nodes
- **Smart Contracts**: Solidity (Dossier.sol)

### Key Directories
- `/app/lib/` - Core business logic modules:
  - `taco.ts` - Encryption/decryption with conditional access
  - `ipfs.ts` - IPFS storage operations
  - `contract.ts` - Smart contract interactions
  - `web3.ts` - Web3 utilities and helpers
  - `pinata.ts` - Pinata gateway integration
  - `codex.ts` - Codex node storage

### Environment Variables
Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy authentication
- `NEXT_PUBLIC_ALCHEMY_API_KEY` - Alchemy RPC provider
- `NEXT_PUBLIC_PINATA_GATEWAY_KEY` - Pinata IPFS gateway
- `NEXT_PUBLIC_POLYGON_AMOY_CONTRACT_ADDRESS` - Deployed contract address

## Development Guidelines

### Component Structure
- Use functional components with TypeScript
- Follow the existing editorial/newspaper-inspired design patterns
- Components should be client-side by default (use 'use client')
- Keep components in `/app/components/`

### State Management
- Use React hooks (useState, useEffect)
- Wagmi hooks for Web3 state
- Privy hooks for authentication

### Error Handling
- Always handle Web3 errors gracefully
- Show user-friendly error messages
- Log technical details to console for debugging

### Code Style
- TypeScript strict mode is enabled
- Use async/await for asynchronous operations
- Follow existing patterns in the codebase
- Import paths use `@/` alias for root directory

### Web3 Integration
- Use wagmi hooks for contract interactions
- Always check wallet connection status
- Handle chain switching gracefully
- Test on Polygon Amoy testnet first

### Security Considerations
- Never expose private keys or sensitive data
- All encryption happens client-side
- Smart contract addresses are environment-specific
- Follow the principle of least privilege for conditions

## Testing

### Test Suite
Comprehensive test coverage using Vitest and React Testing Library:
- Unit tests for all library functions (taco, ipfs, pinata, codex, contract)
- Component tests for React components
- Integration tests for main user flows
- Coverage thresholds: 80% for all metrics

### Running Tests
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test taco.test.ts      # Run specific file
npm test -- -t "encrypt"   # Run tests matching pattern
```

### Key Test Areas
1. **Encryption/Decryption**: TACo service with Dossier conditions
2. **Storage**: IPFS, Pinata, and Codex upload/retrieval
3. **Smart Contracts**: Dossier creation, check-ins, and condition verification
4. **Web3 Integration**: Privy embedded wallets and ethers adapter
5. **User Flows**: Complete encryption workflow and dossier management

## Common Tasks

### Adding a New Condition Type
1. Update the condition interface in relevant components
2. Implement condition logic in smart contract if needed
3. Update UI to handle new condition type
4. Test encryption/decryption with new condition

### Modifying Smart Contract
1. Update `contracts/Dossier.sol`
2. Deploy using `scripts/deploy.py`
3. Update contract address in environment variables
4. Update ABI in frontend if interface changed

### Working with IPFS
- Use Pinata gateway for retrieval (more reliable)
- Helia for direct IPFS uploads
- Always handle IPFS timeouts gracefully
- Store CIDs in smart contract for permanence
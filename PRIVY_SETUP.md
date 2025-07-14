# Privy Integration Setup Guide

## Overview
This guide helps you integrate Privy embedded wallets to enable email sign-in functionality in your Canary application.

## Setup Steps

### 1. Install Dependencies
```bash
npm install @privy-io/react-auth @privy-io/wagmi
```

### 2. Get Privy App ID
1. Go to [Privy Dashboard](https://dashboard.privy.io)
2. Create a new application
3. Copy your App ID from the dashboard

### 3. Environment Variables
Create a `.env.local` file in your project root:

```bash
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here

# WalletConnect Configuration (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

### 4. Configure Privy Dashboard
In your Privy dashboard, configure:

**Allowed Origins:**
- `http://localhost:3000` (for development)
- Your production domain

**Login Methods:**
- ✅ Email
- ✅ Wallet (external wallets)
- ✅ Google (optional)
- ✅ Twitter (optional)

**Embedded Wallets:**
- ✅ Create on login for users without wallets
- ✅ Allow users to export private keys
- ✅ Require user password: No (for seamless UX)

**Chains:**
- ✅ Polygon Amoy (testnet)
- ✅ Ethereum Mainnet (if needed)

### 5. Test the Integration
1. Start your development server: `npm run dev`
2. Click "Sign in with Email" on the landing page
3. Enter your email address
4. Check your email for the verification code
5. Complete the sign-in process

## Features Enabled

### Email Sign-in
- Users can sign in with just their email address
- Privy handles email verification automatically
- No need for external wallet extensions

### Embedded Wallets
- Self-custodial wallets created automatically
- Users can export private keys if needed
- Seamless blockchain interactions

### Multi-Chain Support
- Supports both Ethereum and Polygon
- Automatically switches to correct network
- Works with existing contract interactions

## Code Changes Made

### Web3Provider.tsx
- Added `PrivyProvider` wrapper with configuration
- Configured embedded wallets and email login
- Set default chain to Polygon Amoy

### page.tsx
- Added `usePrivy` hook for authentication
- Enabled email sign-in button functionality
- Added auto sign-in for authenticated users

### package.json
- Added `@privy-io/react-auth` dependency
- Added `@privy-io/wagmi` for wagmi integration

## Troubleshooting

### Common Issues

**"Cannot find module '@privy-io/react-auth'"**
- Run `npm install` to install the new dependencies

**"Invalid App ID"**
- Double-check your App ID in the `.env.local` file
- Ensure the App ID matches your Privy dashboard

**"Origin not allowed"**
- Add your domain to allowed origins in Privy dashboard
- For development: `http://localhost:3000`

**Email verification not working**
- Check spam folder for verification emails
- Ensure email login is enabled in Privy dashboard

### Getting Help
- [Privy Documentation](https://docs.privy.io)
- [Privy Discord](https://discord.gg/privy)
- [GitHub Issues](https://github.com/privy-io/privy-js)

## Next Steps
1. Install the dependencies: `npm install`
2. Set up your Privy app and get the App ID
3. Configure your environment variables
4. Test the email sign-in functionality
5. Deploy to production and update allowed origins

Your Canary application now supports both Web3 wallets and email-based embedded wallets! 
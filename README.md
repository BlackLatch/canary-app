# Canary - Decentralized Deadman Switch

A sophisticated journalistic dead man switch app built with Next.js, TACo (Threshold Access Control), and IPFS for secure conditional file encryption and release.

## Features

- **File Upload & Encryption**: Drag-and-drop or browse to upload sensitive files
- **Conditional Access Control**: Set conditions for when files should be decrypted and released
- **TACo Integration**: Uses Threshold Access Control for secure conditional encryption
- **IPFS Storage**: Decentralized storage for encrypted files
- **Trace Generation**: Creates downloadable `trace.json` metadata for each encrypted file
- **Elegant UI**: Newspaper editorial design inspired interface
- **Mobile Optimized**: Responsive design that works on all devices

## Environment Variables

The application requires the following environment variables to be set:

### Pinata IPFS Configuration
- `NEXT_PUBLIC_PINATA_API_KEY`: Your Pinata API key for IPFS pinning service
- `NEXT_PUBLIC_PINATA_API_SECRET`: Your Pinata API secret for IPFS pinning service
- `NEXT_PUBLIC_PINATA_JWT`: Your Pinata JWT token for authentication
- `NEXT_PUBLIC_PINATA_GATEWAY_URL`: Your Pinata gateway URL for accessing IPFS content

### Codex Node Configuration
- `NEXT_PUBLIC_CODEX_NODE_URL`: URL of your Codex node (defaults to http://localhost:8080)

### WalletConnect Configuration
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: Your WalletConnect project ID for wallet connections

### Environment
- `NODE_ENV`: Set to 'development' or 'production'

Note: All environment variables prefixed with `NEXT_PUBLIC_` will be exposed to the browser. Only use this prefix for variables that are safe to expose to the client.

## Condition Types

1. **No Activity** - Release files if no activity detected for a specified duration
2. **No Check-in** - Release files if no check-in occurs within specified time windows
3. **Location-based** - Release files if location is outside specified region for duration
4. **Keyword Trigger** - Release files if specific keywords are detected in communications

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd canary
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Creating a Deadman Switch

1. **Upload File**: Drag and drop or click to browse for the file you want to encrypt
2. **Set Condition**: Choose the trigger condition and configure parameters:
   - **No Activity**: Specify duration (e.g., "5 DAYS", "72 HOURS")
   - **Location**: Set location and duration outside that region
   - **Keyword**: Define trigger keyword for email monitoring
3. **Add Description**: Optional description for the encrypted capsule
4. **Create Capsule**: Click "Create Encrypted Capsule" to encrypt and upload

### Understanding the Trace JSON

The generated `trace.json` contains:
- `payload_uri`: IPFS URI where encrypted file is stored
- `taco_capsule_uri`: TACo capsule identifier for decryption
- `condition`: Human-readable condition description
- `description`: User-provided description
- `created_at`: Timestamp of creation

### Sharing & Distribution

- **Copy**: Copy the trace.json to clipboard for sharing
- **Download**: Download trace.json file for safe storage
- **Distribute**: Share the trace.json with trusted parties who should have access when conditions are met

## Technical Architecture

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons

### Encryption & Storage
- **TACo SDK** - Threshold Access Control for conditional encryption
- **Helia/IPFS** - Decentralized file storage
- **Conditional Capsules** - Smart contracts for access control

### Fonts & Design
- **Playfair Display** - Elegant serif headings
- **Crimson Text** - Readable serif body text
- **Newspaper Editorial** - Sophisticated journalistic aesthetic

## Development

### Project Structure
```
canary/
├── app/
│   ├── lib/
│   │   └── taco.ts         # TACo SDK integration
│   ├── globals.css         # Global styles and theme
│   ├── layout.tsx          # Root layout with fonts
│   └── page.tsx            # Main application page
├── package.json
└── README.md
```

### Key Components

- **TACo Service** (`app/lib/taco.ts`): Handles file encryption, condition creation, and IPFS storage
- **Main Interface** (`app/page.tsx`): File upload, condition setup, and trace generation UI
- **Editorial Styling** (`app/globals.css`): Custom CSS classes for newspaper aesthetic

## Security Considerations

This is an MVP demonstration. For production use:

- Implement proper wallet integration for TACo authentication
- Add secure key management
- Implement robust condition monitoring
- Add multi-signature requirements for sensitive operations
- Conduct security audits

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **NuCypher/Threshold Network** - For TACo threshold access control
- **IPFS/Protocol Labs** - For decentralized storage infrastructure
- **Next.js Team** - For the excellent React framework

## Disclaimer

This is experimental software intended for demonstration purposes. Use at your own risk for sensitive data. Always test thoroughly before deploying in production environments.
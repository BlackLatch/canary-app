# Smart Contract Testing Guide

## Overview
Comprehensive test suite for the CanaryDossierV2 smart contract with 60+ test cases covering all functionality.

## Test Coverage

### Core Tests (`test/DossierV2.test.js`)
- ✅ Dossier Creation (6 tests)
- ✅ Check-In Functionality (5 tests) 
- ✅ Update Check-In Interval (5 tests)
- ✅ Add File Hash (6 tests)
- ✅ Recipient Management (6 tests)
- ✅ Dossier State Management (8 tests)
- ✅ Encryption Status Check (6 tests)
- ✅ Access Control (5 tests)
- ✅ View Functions (3 tests)
- ✅ Edge Cases (3 tests)

### Integration Tests (`test/DossierV2.integration.test.js`)
- ✅ Journalist Workflow (2 scenarios)
- ✅ Whistleblower Workflow (2 scenarios)
- ✅ Multiple Dossier Management (1 scenario)
- ✅ Emergency Scenarios (2 scenarios)
- ✅ Advanced Update Scenarios (3 scenarios)
- ✅ Gas Optimization Tests (2 scenarios)

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev \
  hardhat \
  @nomicfoundation/hardhat-toolbox \
  @nomicfoundation/hardhat-chai-matchers \
  @nomicfoundation/hardhat-network-helpers \
  @nomiclabs/hardhat-ethers \
  @nomiclabs/hardhat-etherscan \
  chai \
  ethers \
  dotenv
```

### 2. Environment Variables

Create a `.env` file with:

```env
# For deployment (optional for testing)
PRIVATE_KEY=your_private_key_here
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## Running Tests

### Run All Tests
```bash
npx hardhat test
```

### Run Specific Test File
```bash
npx hardhat test test/DossierV2.test.js
npx hardhat test test/DossierV2.integration.test.js
```

### Run with Gas Reporting
```bash
REPORT_GAS=true npx hardhat test
```

### Run with Coverage
```bash
npx hardhat coverage
```

### Run Specific Test Suite
```bash
npx hardhat test --grep "Update Check-In Interval"
npx hardhat test --grep "Journalist Workflow"
```

## Test Scenarios

### 1. Basic Dossier Lifecycle
```javascript
// Create dossier
// Check in regularly
// Update interval
// Add files
// Manage recipients
```

### 2. Emergency Release
```javascript
// Create dossier
// Regular check-ins
// Immediate threat detected
// Release now
// Verify decryption
```

### 3. Going Dark (Pause)
```javascript
// Create dossier
// Pause for safety
// Time passes
// Resume when safe
// Continue check-ins
```

### 4. Automatic Decryption
```javascript
// Create dossier
// Check in regularly
// Miss check-in deadline
// Grace period expires
// Automatic decryption occurs
```

## Test Data

### Sample File Hashes
- `ipfs://QmTest123` - Generic test file
- `ipfs://QmInterviews` - Interview recordings
- `ipfs://QmDocuments` - Document scans
- `ipfs://QmPhotos` - Photo evidence
- `ipfs://QmFinancialRecords` - Financial documents

### Test Intervals
- `3600` - 1 hour (minimum)
- `86400` - 1 day
- `604800` - 1 week
- `2592000` - 30 days (maximum)

### Test Addresses
- `owner` - Dossier creator
- `addr1` - Primary recipient
- `addr2` - Secondary recipient
- `addr3` - Additional contact

## Expected Test Output

```
CanaryDossierV2
  Dossier Creation
    ✓ Should create a dossier with valid parameters (95ms)
    ✓ Should reject creation with invalid check-in interval
    ✓ Should reject creation with no recipients
    ✓ Should reject creation with too many recipients
    ✓ Should reject creation with no files
    ✓ Should enforce max dossiers per user (450ms)
    
  Check-In Functionality
    ✓ Should perform check-in successfully
    ✓ Should not allow check-in on paused dossier
    ✓ Should not allow check-in on released dossier
    ✓ Should not allow check-in on permanently disabled dossier
    ✓ Should check in all active dossiers
    
  Update Check-In Interval
    ✓ Should update check-in interval successfully
    ✓ Should reject invalid intervals
    ✓ Should not allow update on paused dossier
    ✓ Should not allow update on released dossier
    ✓ Should not allow update on permanently disabled dossier
    
  ... (additional test suites)
  
  60 passing (2s)
```

## Common Issues

### Issue: "Dossier does not exist"
- **Cause**: Trying to access dossier with wrong address or ID
- **Solution**: Ensure using correct owner address and dossier ID

### Issue: "Invalid check-in interval"
- **Cause**: Interval outside allowed range (1 hour - 30 days)
- **Solution**: Use interval between 3600 and 2592000 seconds

### Issue: "Dossier must be active to edit"
- **Cause**: Trying to update paused/released/disabled dossier
- **Solution**: Only update active dossiers

### Issue: "Max files per dossier reached"
- **Cause**: Exceeding 100 file limit
- **Solution**: Create new dossier for additional files

## Coverage Report

Run coverage to ensure comprehensive testing:

```bash
npx hardhat coverage
```

Expected coverage:
- Statements: >95%
- Branches: >90%
- Functions: 100%
- Lines: >95%

## Deployment Testing

### Deploy to Local Network
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy to Polygon Amoy
```bash
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### Verify Contract
```bash
npx hardhat verify --network polygonAmoy DEPLOYED_ADDRESS
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Smart Contract Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx hardhat test
      - run: npx hardhat coverage
```

## Security Testing

### Slither Analysis
```bash
pip3 install slither-analyzer
slither contracts/DossierV2.sol
```

### MythX Analysis
```bash
npm install -g truffle-security
truffle run verify DossierV2
```

## Gas Optimization Report

Monitor gas usage for key operations:

| Operation | Gas Used | Cost @ 30 Gwei |
|-----------|----------|----------------|
| Create Dossier | ~250,000 | ~0.0075 ETH |
| Check In | ~50,000 | ~0.0015 ETH |
| Update Interval | ~45,000 | ~0.00135 ETH |
| Add File Hash | ~75,000 | ~0.00225 ETH |
| Add Multiple Files | ~65,000/file | ~0.00195 ETH/file |

## Next Steps

1. ✅ Run full test suite
2. ✅ Check coverage report
3. ✅ Deploy to testnet
4. ✅ Run integration tests on testnet
5. ✅ Security audit
6. ✅ Deploy to mainnet
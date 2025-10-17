// Compile CanaryDossierV2 contract using solc
const fs = require('fs');
const solc = require('solc');
const path = require('path');

// Read the contract source
const contractPath = path.resolve(__dirname, 'contracts', 'DossierV2.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Prepare input for solc
const input = {
  language: 'Solidity',
  sources: {
    'DossierV2.sol': {
      content: source
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

console.log('📦 Compiling CanaryDossierV2...');

// Compile the contract
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
  const errors = output.errors.filter(e => e.severity === 'error');
  if (errors.length > 0) {
    console.error('❌ Compilation failed:');
    errors.forEach(err => console.error(err.formattedMessage));
    process.exit(1);
  }
  // Show warnings
  const warnings = output.errors.filter(e => e.severity === 'warning');
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warn => console.log(warn.formattedMessage));
  }
}

// Extract the contract
const contract = output.contracts['DossierV2.sol']['CanaryDossierV2'];

if (!contract) {
  console.error('❌ Contract not found in compilation output');
  process.exit(1);
}

// Create artifacts directory structure
const artifactsDir = path.resolve(__dirname, 'artifacts', 'contracts', 'CanaryDossierV2.sol');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Save the artifacts
const artifact = {
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object
};

const artifactPath = path.resolve(artifactsDir, 'CanaryDossierV2.json');
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

console.log('✅ Compilation successful!');
console.log('📍 Artifacts saved to:', artifactPath);
console.log('📊 Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');

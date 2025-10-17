// Manual deployment script using ethers.js directly
const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('\n🚀 Deploying CanaryDossierV2 to Status Network Sepolia...\n');

  // Read contract artifacts
  const contractJson = JSON.parse(
    fs.readFileSync('./artifacts/contracts/CanaryDossierV2.sol/CanaryDossierV2.json', 'utf8')
  );

  // Setup provider and wallet
  const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('Deploying with account:', wallet.address);

  // Check balance
  const balance = await wallet.getBalance();
  console.log('Account balance:', ethers.utils.formatEther(balance), 'ETH');

  if (balance.eq(0)) {
    console.error('❌ No ETH balance! You need a small amount of ETH for deployment.');
    console.error('   Get test ETH from a Sepolia faucet.');
    process.exit(1);
  }

  // Create contract factory
  const factory = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet
  );

  console.log('\n📝 Deploying contract...');
  const contract = await factory.deploy();

  console.log('\n⏳ Waiting for deployment...');
  await contract.deployed();

  console.log('\n✅ Contract deployed successfully!');
  console.log('📍 Contract address:', contract.address);
  console.log('📊 Transaction hash:', contract.deployTransaction.hash);
  console.log('🔗 View on explorer: https://sepoliascan.status.network/address/' + contract.address);

  console.log('\n⏳ Waiting for confirmations...');
  const receipt = await contract.deployTransaction.wait(3);
  console.log('✅ Confirmed in block:', receipt.blockNumber);

  // Save deployment info
  const deploymentInfo = {
    network: 'status-sepolia',
    chainId: 1660990954,
    address: contract.address,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
    txHash: contract.deployTransaction.hash,
    blockNumber: receipt.blockNumber,
    explorerUrl: `https://sepoliascan.status.network/address/${contract.address}`
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync('./deployments')) {
    fs.mkdirSync('./deployments');
  }

  // Save deployment info
  const filename = `./deployments/DossierV2_statusSepolia_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved to:', filename);

  // Update .env.local
  console.log('\n📝 Updating .env.local with new contract address...');
  const envFile = '.env.local';
  let envContent = '';

  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }

  const envKey = 'NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS';
  const envLine = `${envKey}=${contract.address}`;

  if (envContent.includes(envKey)) {
    envContent = envContent.replace(
      new RegExp(`${envKey}=.*`, 'g'),
      envLine
    );
  } else {
    envContent += `\n# DossierV2 Contract on Status Network (Deployed ${new Date().toISOString()})\n${envLine}\n`;
  }

  fs.writeFileSync(envFile, envContent);
  console.log('✅ Updated .env.local');

  console.log('\n🎉 Deployment complete!');
  console.log('\n💡 Status Network Features:');
  console.log('   • Gasless transactions via RLN rate-limiting');
  console.log('   • Built on Linea zkEVM');
  console.log('   • Rate limit: 10 requests/second, 100k requests/day');
  console.log('\n🔗 Explorer:', deploymentInfo.explorerUrl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });

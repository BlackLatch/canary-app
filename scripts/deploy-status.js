// Deploy DossierV2 to Status Network Sepolia testnet
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("\n🚀 Deploying CanaryDossierV2 to Status Network Sepolia...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "ETH");

  if (balance.eq(0)) {
    console.error("❌ No ETH balance! Note: Status Network uses gasless transactions via RLN rate-limiting.");
    console.error("   You may still need a small amount of ETH for deployment.");
    console.error("   Get test ETH from a Sepolia faucet.");
    process.exit(1);
  }

  // Get the contract factory
  console.log("\n📦 Compiling contract...");
  const DossierV2 = await hre.ethers.getContractFactory("CanaryDossierV2");

  // Deploy the contract
  console.log("\n📝 Deploying contract...");
  const contract = await DossierV2.deploy();

  // Wait for deployment
  await contract.deployed();

  console.log("\n✅ Contract deployed successfully!");
  console.log("📍 Contract address:", contract.address);
  console.log("📊 Transaction hash:", contract.deployTransaction.hash);
  console.log("🔗 View on explorer: https://sepoliascan.status.network/address/" + contract.address);

  // Wait for confirmations
  console.log("\n⏳ Waiting for confirmations...");
  await contract.deployTransaction.wait(3);

  // Save deployment info
  const deploymentInfo = {
    network: "status-sepolia",
    chainId: 1660990954,
    address: contract.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: contract.deployTransaction.hash,
    blockNumber: contract.deployTransaction.blockNumber,
    explorerUrl: `https://sepoliascan.status.network/address/${contract.address}`
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Save deployment info
  const filename = `./deployments/DossierV2_statusSepolia_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", filename);

  // Update .env.local
  console.log("\n📝 Updating .env.local with new contract address...");
  const envFile = ".env.local";
  let envContent = "";

  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, "utf8");
  }

  const envKey = "NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS";
  const envLine = `${envKey}=${contract.address}`;

  if (envContent.includes(envKey)) {
    // Update existing key
    envContent = envContent.replace(
      new RegExp(`${envKey}=.*`, "g"),
      envLine
    );
  } else {
    // Add new key
    envContent += `\n# DossierV2 Contract on Status Network (Deployed ${new Date().toISOString()})\n${envLine}\n`;
  }

  fs.writeFileSync(envFile, envContent);
  console.log("✅ Updated .env.local");

  console.log("\n🎉 Deployment complete!");
  console.log("\n💡 Status Network Features:");
  console.log("   • Gasless transactions via RLN rate-limiting");
  console.log("   • Built on Linea zkEVM");
  console.log("   • Rate limit: 10 requests/second, 100k requests/day");
  console.log("\n📋 Next steps:");
  console.log("1. Add Status Network to wagmi config");
  console.log("2. Update contract service to support Status Network");
  console.log("3. Test gasless transactions with burner wallets");
  console.log("\n🔗 Explorer:", deploymentInfo.explorerUrl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

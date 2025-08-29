// Deploy DossierV2 to Polygon Amoy
import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("\n🚀 Deploying CanaryDossierV2 to Polygon Amoy...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "MATIC");

  if (balance.eq(0)) {
    console.error("❌ No MATIC balance! Get test MATIC from: https://faucet.polygon.technology/");
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
  console.log("🔗 View on explorer: https://www.oklink.com/amoy/address/" + contract.address);

  // Wait for confirmations before verifying
  console.log("\n⏳ Waiting for confirmations...");
  await contract.deployTransaction.wait(5);

  // Verify the contract
  console.log("\n🔍 Verifying contract on PolygonScan...");
  try {
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified!");
  } catch (error) {
    console.log("⚠️  Verification failed:", error.message);
    console.log("You can verify manually with:");
    console.log(`npx hardhat verify --network polygonAmoy ${contract.address}`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: "polygon-amoy",
    chainId: 80002,
    address: contract.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: contract.deployTransaction.hash,
    blockNumber: contract.deployTransaction.blockNumber
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Save deployment info
  const filename = `./deployments/DossierV2_polygonAmoy_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", filename);

  // Update .env.local
  console.log("\n📝 Updating .env.local with new contract address...");
  const envFile = ".env.local";
  let envContent = "";
  
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, "utf8");
  }

  const envKey = "NEXT_PUBLIC_CANARY_DOSSIER_V2_ADDRESS";
  const envLine = `${envKey}=${contract.address}`;

  if (envContent.includes(envKey)) {
    // Update existing key
    envContent = envContent.replace(
      new RegExp(`${envKey}=.*`, "g"),
      envLine
    );
  } else {
    // Add new key
    envContent += `\n# DossierV2 Contract (Deployed ${new Date().toISOString()})\n${envLine}\n`;
  }

  fs.writeFileSync(envFile, envContent);
  console.log("✅ Updated .env.local");

  console.log("\n🎉 Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Update app/lib/contract.ts with the new address:", contract.address);
  console.log("2. Add the new ABI functions to the contract service");
  console.log("3. Test the deployment with: npx hardhat test --network polygonAmoy");
  console.log("4. Update the frontend to use NEXT_PUBLIC_CANARY_DOSSIER_V2_ADDRESS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
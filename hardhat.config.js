require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-network-helpers");
require("@nomicfoundation/hardhat-ignition-ethers");
require("dotenv").config();
const fs = require("fs");

// Custom task to deploy to Status Network
task("deploy-status", "Deploy DossierV2 to Status Network Sepolia")
  .setAction(async (taskArgs, hre) => {
    console.log("\n🚀 Deploying CanaryDossierV2 to Status Network Sepolia...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await deployer.getBalance();
    console.log("Account balance:", hre.ethers.utils.formatEther(balance), "ETH");

    if (balance.eq(0)) {
      console.error("❌ No ETH balance! Note: Status Network uses gasless transactions via RLN rate-limiting.");
      console.error("   You may still need a small amount of ETH for deployment.");
      console.error("   Get test ETH from a Sepolia faucet.");
      return;
    }

    console.log("\n📦 Compiling contract...");
    const DossierV2 = await hre.ethers.getContractFactory("CanaryDossierV2");

    console.log("\n📝 Deploying contract...");
    const contract = await DossierV2.deploy();
    await contract.deployed();

    console.log("\n✅ Contract deployed successfully!");
    console.log("📍 Contract address:", contract.address);
    console.log("📊 Transaction hash:", contract.deployTransaction.hash);
    console.log("🔗 View on explorer: https://sepoliascan.status.network/address/" + contract.address);

    console.log("\n⏳ Waiting for confirmations...");
    await contract.deployTransaction.wait(3);

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

    if (!fs.existsSync("./deployments")) {
      fs.mkdirSync("./deployments");
    }

    const filename = `./deployments/DossierV2_statusSepolia_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", filename);

    console.log("\n📝 Updating .env.local with new contract address...");
    const envFile = ".env.local";
    let envContent = "";

    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, "utf8");
    }

    const envKey = "NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS";
    const envLine = `${envKey}=${contract.address}`;

    if (envContent.includes(envKey)) {
      envContent = envContent.replace(
        new RegExp(`${envKey}=.*`, "g"),
        envLine
      );
    } else {
      envContent += `\n# DossierV2 Contract on Status Network (Deployed ${new Date().toISOString()})\n${envLine}\n`;
    }

    fs.writeFileSync(envFile, envContent);
    console.log("✅ Updated .env.local");

    console.log("\n🎉 Deployment complete!");
    console.log("\n💡 Status Network Features:");
    console.log("   • Gasless transactions via RLN rate-limiting");
    console.log("   • Built on Linea zkEVM");
    console.log("   • Rate limit: 10 requests/second, 100k requests/day");
    console.log("\n🔗 Explorer:", deploymentInfo.explorerUrl);
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto"
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      chainId: 137,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto"
    },
    statusSepolia: {
      url: 'https://public.sepolia.rpc.status.network',
      chainId: 1660990954,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto"
    }
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || ""
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}
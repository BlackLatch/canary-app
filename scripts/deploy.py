#!/usr/bin/env python3

from ape import accounts, project, networks

def main():
    # Deploy the CanaryDossier contract
    print("🚀 Deploying CanaryDossier contract...")
    
    # Use the first account from your configured accounts
    # For testing, this will use the test mnemonic
    # For mainnet/testnets, make sure you have your account configured
    deployer = accounts[0]
    
    print(f"📝 Deploying from account: {deployer}")
    print(f"💰 Account balance: {deployer.balance / 1e18:.4f} ETH")
    
    # Deploy the contract
    dossier = project.CanaryDossier.deploy(sender=deployer)
    
    print(f"✅ CanaryDossier deployed at: {dossier.address}")
    print(f"🔗 Transaction hash: {dossier.txn_hash}")
    
    # Verify deployment
    print("\n🔍 Verifying deployment...")
    print(f"MIN_CHECK_IN_INTERVAL: {dossier.MIN_CHECK_IN_INTERVAL()} seconds")
    print(f"MAX_CHECK_IN_INTERVAL: {dossier.MAX_CHECK_IN_INTERVAL()} seconds")
    print(f"GRACE_PERIOD: {dossier.GRACE_PERIOD()} seconds")
    
    print("\n🎉 Deployment completed successfully!")
    
    return dossier

if __name__ == "__main__":
    main() 
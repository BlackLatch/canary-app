#!/usr/bin/env python3

from ape import accounts, project, networks, Contract
import click

@click.command()
@click.option('--network', default='ethereum:local:test', help='Network to deploy to (e.g., ethereum:sepolia, ethereum:mainnet)')
@click.option('--account', default='0', help='Account alias or index to use for deployment')
def deploy(network, account):
    """Interactive deployment script for CanaryDossier contract"""
    
    print(f"🌐 Selected network: {network}")
    
    # Connect to network
    with networks.parse_network_choice(network) as provider:
        print(f"🔗 Connected to {provider.name}")
        
        # Get deployer account - handle both alias and index
        try:
            if isinstance(account, str) and not account.isdigit():
                # It's an alias
                deployer = accounts.load(account)
            else:
                # It's an index
                deployer = accounts[int(account)]
        except Exception as e:
            print(f"❌ Error loading account '{account}': {e}")
            print("Available accounts:")
            for i, acc in enumerate(accounts):
                print(f"  {i}: {acc}")
            return
        
        print(f"📝 Deploying from: {deployer}")
        
        # Check balance
        balance = deployer.balance / 1e18
        print(f"💰 Balance: {balance:.4f} ETH")
        
        if balance < 0.01:
            print("⚠️  Warning: Low balance for deployment")
            if not click.confirm("Continue anyway?"):
                return
        
        # Deploy contract
        print("\n🚀 Deploying CanaryDossier...")
        
        try:
            dossier = project.CanaryDossier.deploy(sender=deployer)
            
            print(f"✅ Deployment successful!")
            print(f"📍 Contract address: {dossier.address}")
            print(f"🔗 Transaction hash: {dossier.txn_hash}")
            
            # Test basic functionality
            print("\n🧪 Testing contract...")
            print(f"MIN_CHECK_IN_INTERVAL: {dossier.MIN_CHECK_IN_INTERVAL() / 3600} hours")
            print(f"MAX_CHECK_IN_INTERVAL: {dossier.MAX_CHECK_IN_INTERVAL() / 86400} days")
            print(f"GRACE_PERIOD: {dossier.GRACE_PERIOD() / 3600} hours")
            print(f"MAX_DOSSIERS_PER_USER: {dossier.MAX_DOSSIERS_PER_USER()}")
            
            # Save contract address to file
            with open('deployed_address.txt', 'w') as f:
                f.write(f"Network: {network}\n")
                f.write(f"Contract: {dossier.address}\n")
                f.write(f"Transaction: {dossier.txn_hash}\n")
            print(f"📄 Contract address saved to deployed_address.txt")
            
        except Exception as e:
            print(f"❌ Deployment failed: {e}")
            raise

if __name__ == "__main__":
    deploy() 
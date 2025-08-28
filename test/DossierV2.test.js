const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CanaryDossierV2", function () {
  let contract;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  // Constants from contract
  const MIN_CHECK_IN_INTERVAL = 3600; // 1 hour
  const MAX_CHECK_IN_INTERVAL = 2592000; // 30 days
  const GRACE_PERIOD = 3600; // 1 hour
  const MAX_FILES_PER_DOSSIER = 100;
  const MAX_RECIPIENTS_PER_DOSSIER = 20;

  beforeEach(async function () {
    const DossierV2 = await ethers.getContractFactory("CanaryDossierV2");
    contract = await DossierV2.deploy();
    await contract.deployed();
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
  });

  describe("Dossier Creation", function () {
    it("Should create a dossier with valid parameters", async function () {
      const tx = await contract.createDossier(
        "Test Dossier",
        "Test Description",
        3600,
        [addr1.address],
        ["ipfs://QmTest123"]
      );

      await expect(tx)
        .to.emit(contract, "DossierCreated")
        .withArgs(owner.address, 0, "Test Dossier");

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.name).to.equal("Test Dossier");
      expect(dossier.description).to.equal("Test Description");
      expect(dossier.isActive).to.be.true;
      expect(dossier.checkInInterval).to.equal(3600);
    });

    it("Should reject creation with invalid check-in interval", async function () {
      // Too short
      await expect(
        contract.createDossier(
          "Test",
          "Description",
          1800, // 30 minutes
          [addr1.address],
          ["ipfs://test"]
        )
      ).to.be.revertedWith("Invalid check-in interval");

      // Too long
      await expect(
        contract.createDossier(
          "Test",
          "Description",
          3000000, // > 30 days
          [addr1.address],
          ["ipfs://test"]
        )
      ).to.be.revertedWith("Invalid check-in interval");
    });

    it("Should reject creation with no recipients", async function () {
      await expect(
        contract.createDossier(
          "Test",
          "Description",
          3600,
          [], // No recipients
          ["ipfs://test"]
        )
      ).to.be.revertedWith("Invalid recipients");
    });

    it("Should reject creation with too many recipients", async function () {
      const tooManyRecipients = Array(21).fill(addr1.address);
      await expect(
        contract.createDossier(
          "Test",
          "Description",
          3600,
          tooManyRecipients,
          ["ipfs://test"]
        )
      ).to.be.revertedWith("Invalid recipients");
    });

    it("Should reject creation with no files", async function () {
      await expect(
        contract.createDossier(
          "Test",
          "Description",
          3600,
          [addr1.address],
          [] // No files
        )
      ).to.be.revertedWith("Invalid files");
    });

    it("Should enforce max dossiers per user", async function () {
      // Create maximum number of dossiers
      for (let i = 0; i < 50; i++) {
        await contract.createDossier(
          `Dossier ${i}`,
          "Description",
          3600,
          [addr1.address],
          [`ipfs://test${i}`]
        );
      }

      // Try to create one more
      await expect(
        contract.createDossier(
          "One Too Many",
          "Description",
          3600,
          [addr1.address],
          ["ipfs://test"]
        )
      ).to.be.revertedWith("Max dossiers reached");
    });
  });

  describe("Check-In Functionality", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should perform check-in successfully", async function () {
      const tx = await contract.checkIn(0);
      await expect(tx)
        .to.emit(contract, "CheckInPerformed")
        .withArgs(owner.address, 0);
    });

    it("Should not allow check-in on paused dossier", async function () {
      await contract.pauseDossier(0);
      await expect(contract.checkIn(0)).to.be.revertedWith("Dossier is paused");
    });

    it("Should not allow check-in on released dossier", async function () {
      await contract.releaseNow(0);
      await expect(contract.checkIn(0)).to.be.revertedWith("Dossier already released");
    });

    it("Should not allow check-in on permanently disabled dossier", async function () {
      await contract.permanentlyDisableDossier(0);
      await expect(contract.checkIn(0)).to.be.revertedWith("Dossier permanently disabled");
    });

    it("Should check in all active dossiers", async function () {
      // Create multiple dossiers
      await contract.createDossier(
        "Dossier 2",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test2"]
      );
      await contract.createDossier(
        "Dossier 3",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test3"]
      );

      // Pause one dossier
      await contract.pauseDossier(1);

      const tx = await contract.checkInAll();
      
      // Should emit events for dossiers 0 and 2 (not 1 because it's paused)
      await expect(tx)
        .to.emit(contract, "CheckInPerformed")
        .withArgs(owner.address, 0);
      await expect(tx)
        .to.emit(contract, "CheckInPerformed")
        .withArgs(owner.address, 2);
    });
  });

  describe("Update Check-In Interval", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should update check-in interval successfully", async function () {
      const newInterval = 7200; // 2 hours
      const tx = await contract.updateCheckInInterval(0, newInterval);
      
      await expect(tx)
        .to.emit(contract, "CheckInIntervalUpdated")
        .withArgs(owner.address, 0, newInterval);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.checkInInterval).to.equal(newInterval);
    });

    it("Should reject invalid intervals", async function () {
      // Too short
      await expect(
        contract.updateCheckInInterval(0, 1800)
      ).to.be.revertedWith("Invalid check-in interval");

      // Too long
      await expect(
        contract.updateCheckInInterval(0, 3000000)
      ).to.be.revertedWith("Invalid check-in interval");
    });

    it("Should not allow update on paused dossier", async function () {
      await contract.pauseDossier(0);
      await expect(
        contract.updateCheckInInterval(0, 7200)
      ).to.be.revertedWith("Dossier must be active to edit");
    });

    it("Should not allow update on released dossier", async function () {
      await contract.releaseNow(0);
      await expect(
        contract.updateCheckInInterval(0, 7200)
      ).to.be.revertedWith("Dossier already released");
    });

    it("Should not allow update on permanently disabled dossier", async function () {
      await contract.permanentlyDisableDossier(0);
      await expect(
        contract.updateCheckInInterval(0, 7200)
      ).to.be.revertedWith("Dossier permanently disabled");
    });
  });

  describe("Add File Hash", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://file1"]
      );
    });

    it("Should add a single file hash", async function () {
      const newHash = "ipfs://file2";
      const tx = await contract.addFileHash(0, newHash);
      
      await expect(tx)
        .to.emit(contract, "FileHashAdded")
        .withArgs(owner.address, 0, newHash);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(2);
      expect(dossier.encryptedFileHashes[1]).to.equal(newHash);
    });

    it("Should add multiple file hashes", async function () {
      const newHashes = ["ipfs://file2", "ipfs://file3", "ipfs://file4"];
      const tx = await contract.addMultipleFileHashes(0, newHashes);
      
      for (const hash of newHashes) {
        await expect(tx)
          .to.emit(contract, "FileHashAdded")
          .withArgs(owner.address, 0, hash);
      }

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(4);
    });

    it("Should reject empty file hash", async function () {
      await expect(
        contract.addFileHash(0, "")
      ).to.be.revertedWith("File hash cannot be empty");
    });

    it("Should enforce max files limit", async function () {
      // Add files up to the limit
      const filesToAdd = [];
      for (let i = 1; i < MAX_FILES_PER_DOSSIER; i++) {
        filesToAdd.push(`ipfs://file${i}`);
      }
      await contract.addMultipleFileHashes(0, filesToAdd);

      // Try to add one more
      await expect(
        contract.addFileHash(0, "ipfs://oneMore")
      ).to.be.revertedWith("Max files per dossier reached");
    });

    it("Should not allow adding files to paused dossier", async function () {
      await contract.pauseDossier(0);
      await expect(
        contract.addFileHash(0, "ipfs://newFile")
      ).to.be.revertedWith("Dossier must be active to edit");
    });

    it("Should not allow adding files to released dossier", async function () {
      await contract.releaseNow(0);
      await expect(
        contract.addFileHash(0, "ipfs://newFile")
      ).to.be.revertedWith("Dossier already released");
    });
  });

  describe("Recipient Management", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should add a recipient", async function () {
      const tx = await contract.addRecipient(0, addr2.address);
      
      await expect(tx)
        .to.emit(contract, "RecipientAdded")
        .withArgs(owner.address, 0, addr2.address);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.recipients.length).to.equal(2);
      expect(dossier.recipients[1]).to.equal(addr2.address);
    });

    it("Should remove a recipient", async function () {
      // First add a second recipient
      await contract.addRecipient(0, addr2.address);
      
      // Now remove the first one
      const tx = await contract.removeRecipient(0, addr1.address);
      
      await expect(tx)
        .to.emit(contract, "RecipientRemoved")
        .withArgs(owner.address, 0, addr1.address);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.recipients.length).to.equal(1);
      expect(dossier.recipients[0]).to.equal(addr2.address);
    });

    it("Should not add duplicate recipient", async function () {
      await expect(
        contract.addRecipient(0, addr1.address)
      ).to.be.revertedWith("Recipient already exists");
    });

    it("Should not remove last recipient", async function () {
      await expect(
        contract.removeRecipient(0, addr1.address)
      ).to.be.revertedWith("Cannot remove last recipient");
    });

    it("Should not remove non-existent recipient", async function () {
      await expect(
        contract.removeRecipient(0, addr2.address)
      ).to.be.revertedWith("Recipient not found");
    });

    it("Should enforce max recipients limit", async function () {
      // Add recipients up to the limit
      for (let i = 1; i < MAX_RECIPIENTS_PER_DOSSIER; i++) {
        const wallet = ethers.Wallet.createRandom();
        await contract.addRecipient(0, wallet.address);
      }

      // Try to add one more
      await expect(
        contract.addRecipient(0, addr3.address)
      ).to.be.revertedWith("Max recipients reached");
    });
  });

  describe("Dossier State Management", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should pause and resume dossier", async function () {
      // Pause
      const pauseTx = await contract.pauseDossier(0);
      await expect(pauseTx)
        .to.emit(contract, "DossierPaused")
        .withArgs(owner.address, 0);

      let dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.isActive).to.be.false;

      // Resume
      const resumeTx = await contract.resumeDossier(0);
      await expect(resumeTx)
        .to.emit(contract, "DossierResumed")
        .withArgs(owner.address, 0);

      dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.isActive).to.be.true;
    });

    it("Should release dossier immediately", async function () {
      const tx = await contract.releaseNow(0);
      await expect(tx)
        .to.emit(contract, "DossierReleased")
        .withArgs(owner.address, 0);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.isReleased).to.be.true;
      expect(dossier.isActive).to.be.false;
    });

    it("Should permanently disable dossier", async function () {
      const tx = await contract.permanentlyDisableDossier(0);
      await expect(tx)
        .to.emit(contract, "DossierPermanentlyDisabled")
        .withArgs(owner.address, 0);

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.isPermanentlyDisabled).to.be.true;
      expect(dossier.isActive).to.be.false;
    });

    it("Should not pause already paused dossier", async function () {
      await contract.pauseDossier(0);
      await expect(contract.pauseDossier(0))
        .to.be.revertedWith("Dossier already paused");
    });

    it("Should not resume active dossier", async function () {
      await expect(contract.resumeDossier(0))
        .to.be.revertedWith("Dossier already active");
    });

    it("Should not release already released dossier", async function () {
      await contract.releaseNow(0);
      await expect(contract.releaseNow(0))
        .to.be.revertedWith("Dossier already released");
    });

    it("Should not disable already disabled dossier", async function () {
      await contract.permanentlyDisableDossier(0);
      await expect(contract.permanentlyDisableDossier(0))
        .to.be.revertedWith("Dossier already permanently disabled");
    });
  });

  describe("Encryption Status Check", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600, // 1 hour check-in interval
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should stay encrypted when check-in is recent", async function () {
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.true;
    });

    it("Should decrypt when check-in is overdue", async function () {
      // Fast forward time past check-in interval + grace period
      await time.increase(3600 + 3600 + 1); // interval + grace + 1 second
      
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.false;
    });

    it("Should stay encrypted within grace period", async function () {
      // Fast forward time to just within grace period
      await time.increase(3600 + 1800); // interval + half of grace period
      
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.true;
    });

    it("Should stay encrypted when paused", async function () {
      await contract.pauseDossier(0);
      
      // Fast forward time way past check-in interval
      await time.increase(10000);
      
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.true;
    });

    it("Should decrypt when released", async function () {
      await contract.releaseNow(0);
      
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.false;
    });

    it("Should stay encrypted forever when permanently disabled", async function () {
      await contract.permanentlyDisableDossier(0);
      
      // Fast forward time way past check-in interval
      await time.increase(10000);
      
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(owner.address, 0);
      expect(shouldStayEncrypted).to.be.true;
    });
  });

  describe("Access Control", function () {
    beforeEach(async function () {
      await contract.createDossier(
        "Test Dossier",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );
    });

    it("Should not allow non-owner to check in", async function () {
      await expect(
        contract.connect(addr1).checkIn(0)
      ).to.be.revertedWith("Dossier does not exist");
    });

    it("Should not allow non-owner to update interval", async function () {
      await expect(
        contract.connect(addr1).updateCheckInInterval(0, 7200)
      ).to.be.revertedWith("Dossier does not exist");
    });

    it("Should not allow non-owner to add files", async function () {
      await expect(
        contract.connect(addr1).addFileHash(0, "ipfs://hack")
      ).to.be.revertedWith("Dossier does not exist");
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        contract.connect(addr1).pauseDossier(0)
      ).to.be.revertedWith("Dossier does not exist");
    });

    it("Should not allow non-owner to release", async function () {
      await expect(
        contract.connect(addr1).releaseNow(0)
      ).to.be.revertedWith("Dossier does not exist");
    });
  });

  describe("View Functions", function () {
    it("Should get user dossier IDs", async function () {
      await contract.createDossier(
        "Dossier 1",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test1"]
      );
      await contract.createDossier(
        "Dossier 2",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test2"]
      );

      const dossierIds = await contract.getUserDossierIds(owner.address);
      expect(dossierIds.length).to.equal(2);
      expect(dossierIds[0]).to.equal(0);
      expect(dossierIds[1]).to.equal(1);
    });

    it("Should check if user exists", async function () {
      let exists = await contract.userExists(owner.address);
      expect(exists).to.be.false;

      await contract.createDossier(
        "Test",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );

      exists = await contract.userExists(owner.address);
      expect(exists).to.be.true;
    });

    it("Should get dossier details", async function () {
      await contract.createDossier(
        "Test Dossier",
        "Test Description",
        3600,
        [addr1.address, addr2.address],
        ["ipfs://file1", "ipfs://file2"]
      );

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.name).to.equal("Test Dossier");
      expect(dossier.description).to.equal("Test Description");
      expect(dossier.checkInInterval).to.equal(3600);
      expect(dossier.recipients.length).to.equal(2);
      expect(dossier.encryptedFileHashes.length).to.equal(2);
    });
  });

  describe("Edge Cases and Complex Scenarios", function () {
    it("Should handle multiple dossiers with different states", async function () {
      // Create multiple dossiers
      await contract.createDossier("Active", "Description", 3600, [addr1.address], ["ipfs://1"]);
      await contract.createDossier("Paused", "Description", 3600, [addr1.address], ["ipfs://2"]);
      await contract.createDossier("Released", "Description", 3600, [addr1.address], ["ipfs://3"]);
      await contract.createDossier("Disabled", "Description", 3600, [addr1.address], ["ipfs://4"]);

      // Set different states
      await contract.pauseDossier(1);
      await contract.releaseNow(2);
      await contract.permanentlyDisableDossier(3);

      // Check encryption status for each
      expect(await contract.shouldDossierStayEncrypted(owner.address, 0)).to.be.true; // Active
      expect(await contract.shouldDossierStayEncrypted(owner.address, 1)).to.be.true; // Paused
      expect(await contract.shouldDossierStayEncrypted(owner.address, 2)).to.be.false; // Released
      expect(await contract.shouldDossierStayEncrypted(owner.address, 3)).to.be.true; // Disabled
    });

    it("Should correctly update lastCheckIn when resuming", async function () {
      await contract.createDossier(
        "Test",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );

      const initialDossier = await contract.getDossier(owner.address, 0);
      const initialCheckIn = initialDossier.lastCheckIn;

      // Pause and wait
      await contract.pauseDossier(0);
      await time.increase(1000);

      // Resume
      await contract.resumeDossier(0);

      const resumedDossier = await contract.getDossier(owner.address, 0);
      expect(resumedDossier.lastCheckIn).to.be.gt(initialCheckIn);
    });

    it("Should handle rapid state changes correctly", async function () {
      await contract.createDossier(
        "Test",
        "Description",
        3600,
        [addr1.address],
        ["ipfs://test"]
      );

      // Pause, update interval, add file, resume - all in sequence
      await contract.pauseDossier(0);
      
      // These should fail because dossier is paused
      await expect(contract.updateCheckInInterval(0, 7200))
        .to.be.revertedWith("Dossier must be active to edit");
      await expect(contract.addFileHash(0, "ipfs://new"))
        .to.be.revertedWith("Dossier must be active to edit");

      // Resume and try again
      await contract.resumeDossier(0);
      await contract.updateCheckInInterval(0, 7200);
      await contract.addFileHash(0, "ipfs://new");

      const dossier = await contract.getDossier(owner.address, 0);
      expect(dossier.checkInInterval).to.equal(7200);
      expect(dossier.encryptedFileHashes.length).to.equal(2);
    });
  });
});
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DossierV2 Integration Tests", function () {
  let contract;
  let journalist, source, newsOrg, backup;

  beforeEach(async function () {
    const DossierV2 = await ethers.getContractFactory("CanaryDossierV2");
    contract = await DossierV2.deploy();
    await contract.deployed();
    [journalist, source, newsOrg, backup] = await ethers.getSigners();
  });

  describe("Journalist Workflow", function () {
    it("Should handle complete journalist protection workflow", async function () {
      // Journalist creates a dossier with investigation files
      const investigationFiles = [
        "ipfs://QmInterviews",
        "ipfs://QmDocuments",
        "ipfs://QmPhotos"
      ];

      await contract.connect(journalist).createDossier(
        "Panama Papers Investigation",
        "Encrypted evidence of offshore accounts",
        86400, // 24 hour check-in
        [newsOrg.address, backup.address],
        investigationFiles
      );

      // Check initial state
      let dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.isActive).to.be.true;
      expect(dossier.encryptedFileHashes.length).to.equal(3);

      // Day 1: Journalist checks in
      await time.increase(20 * 3600); // 20 hours later
      await contract.connect(journalist).checkIn(0);

      // Journalist discovers more evidence and adds it
      await contract.connect(journalist).addFileHash(0, "ipfs://QmNewEvidence");
      dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(4);

      // Journalist realizes they need more frequent check-ins due to danger
      await contract.connect(journalist).updateCheckInInterval(0, 3600); // 1 hour
      dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.checkInInterval).to.equal(3600);

      // Journalist adds their editor as recipient
      await contract.connect(journalist).addRecipient(0, backup.address);

      // Verify encryption status is maintained
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(journalist.address, 0);
      expect(shouldStayEncrypted).to.be.true;

      // Simulate journalist going dark (no check-in)
      await time.increase(3600 + 3600 + 1); // Past interval + grace period

      // Now the dossier should decrypt
      const shouldDecrypt = await contract.shouldDossierStayEncrypted(journalist.address, 0);
      expect(shouldDecrypt).to.be.false; // Data is now accessible to recipients
    });

    it("Should handle journalist temporarily going underground", async function () {
      // Create dossier
      await contract.connect(journalist).createDossier(
        "Sensitive Investigation",
        "Must protect sources",
        7200, // 2 hour check-in
        [newsOrg.address],
        ["ipfs://QmSensitiveData"]
      );

      // Journalist needs to go underground temporarily
      await contract.connect(journalist).pauseDossier(0);

      // Time passes while journalist is in hiding
      await time.increase(86400); // 24 hours

      // Data should still be encrypted despite no check-ins
      let shouldStayEncrypted = await contract.shouldDossierStayEncrypted(journalist.address, 0);
      expect(shouldStayEncrypted).to.be.true;

      // Journalist returns and resumes
      await contract.connect(journalist).resumeDossier(0);

      // After resume, check-in timer starts fresh
      const dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.isActive).to.be.true;
    });
  });

  describe("Whistleblower Workflow", function () {
    it("Should handle whistleblower protection with immediate release option", async function () {
      // Whistleblower creates dossier with corporate fraud evidence
      await contract.connect(source).createDossier(
        "Corporate Fraud Evidence",
        "Illegal accounting practices documentation",
        604800, // 7 day check-in
        [newsOrg.address, backup.address],
        ["ipfs://QmFinancialRecords", "ipfs://QmEmails", "ipfs://QmMemos"]
      );

      // Regular check-ins for a month
      for (let week = 0; week < 4; week++) {
        await time.increase(6 * 86400); // 6 days
        await contract.connect(source).checkIn(0);
      }

      // Whistleblower discovers immediate threat and decides to release
      await contract.connect(source).releaseNow(0);

      // Verify immediate release
      const dossier = await contract.getDossier(source.address, 0);
      expect(dossier.isReleased).to.be.true;
      expect(dossier.isActive).to.be.false;

      // Data should now be decrypted
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(source.address, 0);
      expect(shouldStayEncrypted).to.be.false;
    });

    it("Should handle whistleblower aborting mission", async function () {
      // Create dossier
      await contract.connect(source).createDossier(
        "Classified Information",
        "Government surveillance program",
        86400,
        [newsOrg.address],
        ["ipfs://QmClassified"]
      );

      // Situation becomes too dangerous, permanently disable
      await contract.connect(source).permanentlyDisableDossier(0);

      // Verify permanent encryption
      const dossier = await contract.getDossier(source.address, 0);
      expect(dossier.isPermanentlyDisabled).to.be.true;

      // Even after long time, data stays encrypted
      await time.increase(30 * 86400); // 30 days
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(source.address, 0);
      expect(shouldStayEncrypted).to.be.true;
    });
  });

  describe("Multiple Dossier Management", function () {
    it("Should handle journalist managing multiple investigations", async function () {
      // Create multiple dossiers for different investigations
      const investigations = [
        { name: "Tax Evasion", interval: 86400, files: ["ipfs://QmTax1"] },
        { name: "Political Corruption", interval: 43200, files: ["ipfs://QmPol1", "ipfs://QmPol2"] },
        { name: "Environmental Crimes", interval: 172800, files: ["ipfs://QmEnv1", "ipfs://QmEnv2", "ipfs://QmEnv3"] }
      ];

      for (const inv of investigations) {
        await contract.connect(journalist).createDossier(
          inv.name,
          `Investigation: ${inv.name}`,
          inv.interval,
          [newsOrg.address],
          inv.files
        );
      }

      // Check all dossiers exist
      const dossierIds = await contract.getUserDossierIds(journalist.address);
      expect(dossierIds.length).to.equal(3);

      // Perform bulk check-in
      await contract.connect(journalist).checkInAll();

      // Update one investigation with new evidence
      await contract.connect(journalist).addFileHash(1, "ipfs://QmPol3");

      // Pause one investigation temporarily
      await contract.connect(journalist).pauseDossier(2);

      // Verify states
      const dossier0 = await contract.getDossier(journalist.address, 0);
      const dossier1 = await contract.getDossier(journalist.address, 1);
      const dossier2 = await contract.getDossier(journalist.address, 2);

      expect(dossier0.isActive).to.be.true;
      expect(dossier1.isActive).to.be.true;
      expect(dossier1.encryptedFileHashes.length).to.equal(3);
      expect(dossier2.isActive).to.be.false;
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle rapid updates during emergency", async function () {
      // Create urgent dossier
      await contract.connect(journalist).createDossier(
        "Breaking Story",
        "Time-sensitive investigation",
        3600, // 1 hour initial
        [newsOrg.address],
        ["ipfs://QmUrgent1"]
      );

      // Situation escalates, need more frequent check-ins
      await contract.connect(journalist).updateCheckInInterval(0, 1800); // 30 min

      // Add multiple files rapidly
      const urgentFiles = [
        "ipfs://QmUrgent2",
        "ipfs://QmUrgent3",
        "ipfs://QmUrgent4"
      ];
      await contract.connect(journalist).addMultipleFileHashes(0, urgentFiles);

      // Add emergency contacts
      await contract.connect(journalist).addRecipient(0, backup.address);

      // Verify all updates
      const dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.checkInInterval).to.equal(1800);
      expect(dossier.encryptedFileHashes.length).to.equal(4);
      expect(dossier.recipients.length).to.equal(2);
    });

    it("Should handle loss of access scenario", async function () {
      // Create dossier
      await contract.connect(journalist).createDossier(
        "Critical Evidence",
        "Must be protected",
        7200, // 2 hours
        [newsOrg.address, backup.address],
        ["ipfs://QmCritical"]
      );

      // Regular check-ins
      await contract.connect(journalist).checkIn(0);
      await time.increase(3600);
      await contract.connect(journalist).checkIn(0);

      // Journalist loses access (simulate by advancing time without check-in)
      await time.increase(7200 + 3600 + 1); // interval + grace + 1

      // Verify automatic decryption
      const shouldStayEncrypted = await contract.shouldDossierStayEncrypted(journalist.address, 0);
      expect(shouldStayEncrypted).to.be.false;

      // Recipients can now access the data
      const dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.recipients).to.include(newsOrg.address);
      expect(dossier.recipients).to.include(backup.address);
    });
  });

  describe("Advanced Update Scenarios", function () {
    it("Should handle complex file management", async function () {
      // Start with minimal dossier
      await contract.connect(source).createDossier(
        "Growing Investigation",
        "Expanding evidence base",
        86400,
        [newsOrg.address],
        ["ipfs://QmInitial"]
      );

      // Progressively add evidence as investigation grows
      const evidenceBatches = [
        ["ipfs://QmBatch1a", "ipfs://QmBatch1b"],
        ["ipfs://QmBatch2a", "ipfs://QmBatch2b", "ipfs://QmBatch2c"],
        ["ipfs://QmBatch3a"]
      ];

      for (const batch of evidenceBatches) {
        await time.increase(3600); // Some time between batches
        await contract.connect(source).addMultipleFileHashes(0, batch);
        await contract.connect(source).checkIn(0); // Keep dossier active
      }

      // Verify all files added
      const dossier = await contract.getDossier(source.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(7); // 1 initial + 6 added
    });

    it("Should handle recipient management during investigation", async function () {
      // Create dossier with initial recipient
      await contract.connect(journalist).createDossier(
        "Collaborative Investigation",
        "Multiple parties involved",
        43200,
        [newsOrg.address],
        ["ipfs://QmCollab"]
      );

      // Add trusted colleague
      await contract.connect(journalist).addRecipient(0, backup.address);

      // Source provides info, add them too
      await contract.connect(journalist).addRecipient(0, source.address);

      // News org compromised, remove them
      await contract.connect(journalist).removeRecipient(0, newsOrg.address);

      // Verify final recipient list
      const dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.recipients).to.not.include(newsOrg.address);
      expect(dossier.recipients).to.include(backup.address);
      expect(dossier.recipients).to.include(source.address);
      expect(dossier.recipients.length).to.equal(2);
    });

    it("Should handle interval adjustments based on threat level", async function () {
      // Start with low-risk interval
      await contract.connect(source).createDossier(
        "Adaptive Security",
        "Threat level varies",
        604800, // 7 days (low risk)
        [newsOrg.address],
        ["ipfs://QmAdaptive"]
      );

      // Threat increases, shorten interval
      await contract.connect(source).updateCheckInInterval(0, 86400); // 1 day

      // Threat escalates further
      await contract.connect(source).updateCheckInInterval(0, 3600); // 1 hour

      // Threat subsides
      await contract.connect(source).updateCheckInInterval(0, 259200); // 3 days

      // Verify final state
      const dossier = await contract.getDossier(source.address, 0);
      expect(dossier.checkInInterval).to.equal(259200);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should efficiently handle batch operations", async function () {
      // Create dossier
      await contract.connect(journalist).createDossier(
        "Batch Test",
        "Testing batch operations",
        86400,
        [newsOrg.address],
        ["ipfs://QmBatch"]
      );

      // Batch add files (more efficient than individual adds)
      const files = Array(10).fill(0).map((_, i) => `ipfs://QmFile${i}`);
      const batchTx = await contract.connect(journalist).addMultipleFileHashes(0, files);
      const batchReceipt = await batchTx.wait();

      // Compare with individual adds (would be more expensive)
      // This test verifies batch operation works and is preferred
      expect(batchReceipt.status).to.equal(1);

      const dossier = await contract.getDossier(journalist.address, 0);
      expect(dossier.encryptedFileHashes.length).to.equal(11);
    });

    it("Should handle checkInAll efficiently for multiple dossiers", async function () {
      // Create multiple dossiers
      for (let i = 0; i < 5; i++) {
        await contract.connect(journalist).createDossier(
          `Dossier ${i}`,
          "Description",
          86400,
          [newsOrg.address],
          [`ipfs://Qm${i}`]
        );
      }

      // Single transaction to check in all
      const tx = await contract.connect(journalist).checkInAll();
      const receipt = await tx.wait();

      // Verify all were checked in with single transaction
      expect(receipt.status).to.equal(1);
      expect(receipt.events.filter(e => e.event === "CheckInPerformed").length).to.equal(5);
    });
  });
});
// Hardhat Ignition deployment module for CanaryDossierV2
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CanaryDossierV2Module", (m) => {
  // Deploy the CanaryDossierV2 contract
  const dossierV2 = m.contract("CanaryDossierV2");

  return { dossierV2 };
});

const { customAlphabet } = require("nanoid");
const { Op } = require("sequelize");
const Patient = require("../models/patient");
const Claim = require("../models/claims/claim");

// Configuration
const FOLDER_NUMBER_PREFIX = "HMS";
const CLAIM_REFERENCE_PREFIX = "CLM";

// Generate folder number (format: HMS-2025-1234)
const generateFolderNumber = async () => {
  const numericPart = customAlphabet("1234567890", 4)(); // 4 digits
  const currentYear = new Date().getFullYear();
  const proposedNumber = `${FOLDER_NUMBER_PREFIX}-${currentYear}-${numericPart}`;

  const existing = await Patient.findOne({
    where: { folder_number: proposedNumber },
  });

  // Regenerate if it already exists
  return existing ? generateFolderNumber() : proposedNumber;
};

// Generate claim reference (format: CLM-2025-1234567890)
const generateClaimsReference = async () => {
  const numericPart = customAlphabet("1234567890", 10)(); // 10 digits
  const currentYear = new Date().getFullYear();
  const proposedRef = `${CLAIM_REFERENCE_PREFIX}-${currentYear}-${numericPart}`;

  const existing = await Claim.findOne({
    where: { claim_reference_number: proposedRef },
  });

  // Regenerate if it already exists
  return existing ? generateClaimsReference() : proposedRef;
};

// Export both functions
module.exports = {
  generateFolderNumber,
  generateClaimsReference,
};

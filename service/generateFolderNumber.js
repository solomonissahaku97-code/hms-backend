const { Op } = require("sequelize");
const Patient = require("../models/patient");
const Claim = require("../models/claims/claim");
const sequelize = require("../config/database");

// Configuration
const FOLDER_NUMBER_PREFIX = "HMS";
const CLAIM_REFERENCE_PREFIX = "CLM";

/**
 * Generate a unique folder number using an atomic database counter.
 * Format: HMS-YYYY-NNNN (e.g., HMS-2026-0001)
 *
 * Uses a sequence table for atomic increment to prevent race conditions
 * when multiple staff register patients simultaneously.
 */
const generateFolderNumber = async () => {
  const currentYear = new Date().getFullYear();
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use raw SQL to atomically increment the counter for this year
      // This prevents two concurrent requests from getting the same number
      const [result] = await sequelize.query(`
        INSERT INTO folder_number_sequences (year, last_number, created_at, updated_at)
        VALUES (:year, 1, NOW(), NOW())
        ON CONFLICT (year) DO UPDATE
        SET last_number = folder_number_sequences.last_number + 1,
            updated_at = NOW()
        RETURNING last_number;
      `, {
        replacements: { year: currentYear },
        type: sequelize.QueryTypes.SELECT,
      });

      const seqNum = result.last_number;
      const numericPart = String(seqNum).padStart(4, '0');
      const proposedNumber = `${FOLDER_NUMBER_PREFIX}-${currentYear}-${numericPart}`;

      // Verify uniqueness (belt-and-suspenders)
      const existing = await Patient.findOne({
        where: { folder_number: proposedNumber },
      });

      if (!existing) {
        return proposedNumber;
      }
      // If collision (extremely rare), retry
    } catch (error) {
      // If the sequence table doesn't exist, create it and retry
      if (error.message?.includes('relation "folder_number_sequences" does not exist')) {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS folder_number_sequences (
            year INTEGER PRIMARY KEY,
            last_number INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);
        continue;
      }
      console.error('Error generating folder number (attempt', attempt + 1, '):', error.message);
    }
  }

  // Fallback: use the old nanoid method with collision check
  const { customAlphabet } = require("nanoid");
  const numericPart = customAlphabet("1234567890", 4)();
  const fallbackYear = new Date().getFullYear();
  const proposedNumber = `${FOLDER_NUMBER_PREFIX}-${fallbackYear}-${numericPart}`;
  const existing = await Patient.findOne({ where: { folder_number: proposedNumber } });
  return existing ? `${FOLDER_NUMBER_PREFIX}-${fallbackYear}-${customAlphabet("1234567890", 4)()}` : proposedNumber;
};

// Generate claim reference (format: CLM-2025-1234567890)
const generateClaimsReference = async () => {
  const numericPart = require("nanoid").customAlphabet("1234567890", 10)();
  const currentYear = new Date().getFullYear();
  const proposedRef = `${CLAIM_REFERENCE_PREFIX}-${currentYear}-${numericPart}`;

  const existing = await Claim.findOne({
    where: { claim_reference_number: proposedRef },
  });

  return existing ? generateClaimsReference() : proposedRef;
};

// Export both functions
module.exports = {
  generateFolderNumber,
  generateClaimsReference,
};

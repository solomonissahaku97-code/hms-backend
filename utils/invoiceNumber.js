// utils/invoiceNumber.js

/**
 * Generates a unique, bank-style invoice number
 * Example: INV-250813-483271
 * Format: {PREFIX}-{YYMMDD}-{6 DIGITS}
 */
function generateInvoiceNumber(prefix = "INV") {
  const date = new Date();

  // YYMMDD format
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  // Random 6-digit sequence (can be replaced with DB sequence)
  const randomSeq = Math.floor(100000 + Math.random() * 900000);

  return `${prefix}-${yy}${mm}${dd}-${randomSeq}`;
}

module.exports = generateInvoiceNumber;

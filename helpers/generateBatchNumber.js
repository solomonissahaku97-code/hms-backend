const generateBatchNumber = () => {
    const prefix = "BATCH";
    const datePart = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const uniquePart = Math.random().toString(36).substr(2, 5).toUpperCase(); // Random 5 chars
    return `${prefix}-${datePart}-${uniquePart}`;
  };
  
  module.exports = generateBatchNumber;
  
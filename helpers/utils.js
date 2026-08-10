const fs = require('fs');
const path = require('path');

// Utility function to get base URL
const getBaseUrl = () => {
  const baseUrl = process.env.NODE_ENV === 'production' ? process.env.APP_URL : (process.env.APP_URL_DEV || 'http://localhost:5008');
  return `${baseUrl}/uploads/logos/`;
};

// Helper function to save a base64 image
const saveBase64Image = async (base64Str, fileName) => {
  const buffer = Buffer.from(base64Str.split(',')[1], 'base64');
  const filePath = path.join(__dirname, '../uploads/logos/', fileName);

  await fs.promises.writeFile(filePath, buffer);
  return fileName;
};

module.exports = { getBaseUrl, saveBase64Image };

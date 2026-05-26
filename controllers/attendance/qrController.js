const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const QrCode = require("../../models/QrCode");
const cron = require("node-cron");

exports.generateQrCode = async (req, res) => {
  try {
    const token = uuidv4(); // Generate unique token
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Expires in 5 minutes

    // Store QR code details in DB
    const qrCode = await QrCode.create({ token, expiresAt });

    // Generate QR code as a data URL
    const qrCodeImage = await QRCode.toDataURL(token);

    return res.json({ success: true, qrCodeImage, qrCodeId: qrCode.id });
  } catch (error) {
    console.error("QR Code Generation Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate QR code" });

  }
};

// Fetch the latest QR Code
exports.getLatestQrCode = async (req, res) => {
  try {
    // Find the latest QR code
    const qrCode = await QrCode.findOne({
      order: [["createdAt", "DESC"]], // Order by newest first
    });

    if (!qrCode) {
      return res.status(404).json({ success: false, message: "No QR Code found" });
    }

    // Generate QR code image from token
    const qrCodeImage = await QRCode.toDataURL(qrCode.token);

    // check if qrcode is not found
    if (!qrCodeImage) {
      return res.status(404).json({ success: false, message: "QR Code image not found" });
    }

    return res.json({ success: true, qrCodeImage, qrCodeId: qrCode.id });
  } catch (error) {
    console.error("Fetch Latest QR Code Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch QR code" });
  }
};








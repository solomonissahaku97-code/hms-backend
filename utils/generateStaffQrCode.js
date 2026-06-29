const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const QrCode = require("../models/QrCode");

const generateStaffQrCode = async (staffId,institution_id, transaction = null) => {
    // Generate a secure unique token
    const qrToken = uuidv4();

    // Save to database
    const qr = await QrCode.create(
        {
            staff_id: staffId,
            institution_id,
            qr_code: qrToken,
            status: "ACTIVE"
        },
        transaction ? { transaction } : {}
    );

    // Generate QR image (base64)
    const qrImage = await QRCode.toDataURL(qrToken);

    return {
        qr,
        qrImage
    };
};

module.exports = generateStaffQrCode;
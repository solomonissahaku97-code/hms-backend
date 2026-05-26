const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Save files in the "uploads" folder
    },
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}_${file.originalname}`;
        cb(null, fileName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        const fileTypes = /pdf|jpg|jpeg|png|doc|docx|xml/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG, PDF, DOC, DOCX, and XML files are allowed."));
        }
    },
});

// Middleware function to handle file upload
const uploadToLocal = (fieldName) => {
    return (req, res, next) => {
        if (req.file) {
            req.body.test = `/uploads/${req.file.filename}`; // Save local file path
        }
        next();
    };
};

module.exports = { upload, uploadToLocal };

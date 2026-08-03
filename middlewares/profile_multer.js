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

// Middleware for gallery uploads to set correct path
const uploadGalleryToLocal = () => {
    return (req, res, next) => {
        if (req.file) {
            req.body.gallery_image = `/uploads/gallery/${req.file.filename}`;
        }
        next();
    };
};

// Dedicated uploader for lab result attachments (images / scans / PDFs), 10MB limit
const labAttachmentsUpload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf|webp|gif/;
        const extname = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowed.test(file.mimetype);
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, JPEG, PNG, WEBP, GIF and PDF files are allowed.'));
        }
    },
});

// Ensure gallery uploads directory exists
const galleryDir = path.join(uploadDir, "gallery");
if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(galleryDir, { recursive: true });
}

// Gallery image uploader: images only, 5MB limit, stored in uploads/gallery/
const galleryUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, galleryDir),
        filename: (req, file, cb) => {
            const fileName = `gallery_${Date.now()}_${file.originalname}`;
            cb(null, fileName);
        },
    }),
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|gif/;
        const extname = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowed.test(file.mimetype);
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, JPEG, PNG, WEBP, GIF) are allowed for gallery.'));
        }
    },
});

module.exports = { upload, uploadToLocal, labAttachmentsUpload, galleryUpload, uploadGalleryToLocal };

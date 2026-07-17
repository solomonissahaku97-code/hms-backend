const jwt = require("jsonwebtoken");
const { Admin, Staff } = require("../models");
const SuperAdmin = require("../models/superadmin");

const eitherAuthOrAdmin = async (req, res, next) => {
    try {
        // Get Authorization Header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required.",
            });
        }

        // Extract Token
        const token = authHeader.split(" ")[1];

        console.log("Token:", token);

        // Verify Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("Decoded Token:", decoded);

        /**
         * Expected JWT payload:
         * {
         *   id: "uuid",
         *   role: "admin" | "staff" | "super_admin"
         * }
         */

        // Check Super Admin
        const superAdmin = await SuperAdmin.findByPk(decoded.id);

        if (superAdmin) {
            console.log("Authenticated as Super Admin");

            req.superAdmin = superAdmin;
            req.user = superAdmin;

            return next();
        }

        // Check Admin
        const admin = await Admin.findByPk(decoded.id);

        if (admin) {
            console.log("Authenticated as Admin");

            req.admin = admin;
            req.user = admin;

            return next();
        }

        // Check Staff
        const staff = await Staff.findByPk(decoded.id);

        if (staff) {
            console.log("Authenticated as Staff");

            req.staff = staff;
            req.user = staff;

            return next();
        }

        // User not found
        return res.status(403).json({
            success: false,
            message: "Not authorized as Admin, Staff, or Super Admin.",
        });
    } catch (error) {
        console.log("AUTH ERROR:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(403).json({
                success: false,
                message: "Token has expired.",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(403).json({
                success: false,
                message: "Invalid token.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication failed.",
            error: error.message,
        });
    }
};

module.exports = eitherAuthOrAdmin;
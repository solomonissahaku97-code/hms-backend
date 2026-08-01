const jwt = require("jsonwebtoken");
const { Admin, Staff, Permission } = require("../models");
const SuperAdmin = require("../models/superadmin");
const InstitutionSubscription = require("../models/InstitutionSubscription");
const moment = require("moment");

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

        // Verify Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        /**
         * Expected JWT payload:
         * {
         *   id: "uuid",
         *   role_id: "uuid" | null,
         *   role_name: "string" | null,
         *   permissions: ["permission_name", ...]
         * }
         */

        // Attach JWT claims to request for permission checks
        req.role_id = decoded.role_id || null;
        req.role_name = decoded.role_name || null;
        req.permissions = decoded.permissions || [];

        // Check Super Admin
        const superAdmin = await SuperAdmin.findByPk(decoded.id);

        if (superAdmin) {
            console.log("Authenticated as Super Admin");
            req.superAdmin = superAdmin;
            req.user = superAdmin;
            req.permissions = req.permissions.length > 0 ? req.permissions : ['*']; // Super admin has all permissions
            return next();
        }

        // Check Admin
        const admin = await Admin.findByPk(decoded.id);

        if (admin) {
            console.log("Authenticated as Admin");
            req.admin = admin;
            req.user = admin;
            req.permissions = req.permissions.length > 0 ? req.permissions : ['*']; // Admin has all permissions

            const institutionId = admin.institution_id;
            if (institutionId) {
                const activeSub = await InstitutionSubscription.findOne({
                    where: { institutionId },
                    order: [['createdAt', 'DESC']],
                });

                if (activeSub && activeSub.expiryDate && moment().isAfter(activeSub.expiryDate)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your subscription has expired. Please renew to continue.',
                        code: 'SUBSCRIPTION_EXPIRED',
                        expiryDate: activeSub.expiryDate,
                    });
                }
            }

            return next();
        }

        // Check Staff
        const staff = await Staff.findByPk(decoded.id);

        if (staff) {
            console.log("Authenticated as Staff");
            req.staff = staff;
            req.staffId = staff.id;
            req.user = staff;

            const institutionId = staff.institution_id;
            if (institutionId) {
                const activeSub = await InstitutionSubscription.findOne({
                    where: { institutionId },
                    order: [['createdAt', 'DESC']],
                });

                if (activeSub && activeSub.expiryDate && moment().isAfter(activeSub.expiryDate)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your subscription has expired. Please renew to continue.',
                        code: 'SUBSCRIPTION_EXPIRED',
                        expiryDate: activeSub.expiryDate,
                    });
                }
            }

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
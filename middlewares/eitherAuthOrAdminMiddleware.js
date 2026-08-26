const jwt = require("jsonwebtoken");
const { Admin, Staff, Permission, User, Role } = require("../models");
const SuperAdmin = require("../models/superadmin");
const InstitutionSubscription = require("../models/InstitutionSubscription");
const moment = require("moment");

/**
 * Check subscription expiry for institution-scoped users.
 * Returns a 403 response object if expired, or null if OK.
 */
const checkSubscription = async (institutionId) => {
    if (!institutionId) return null;
    const activeSub = await InstitutionSubscription.findOne({
        where: { institutionId },
        order: [['createdAt', 'DESC']],
    });
    if (activeSub && activeSub.expiryDate && moment().isAfter(activeSub.expiryDate)) {
        return {
            success: false,
            message: 'Your subscription has expired. Please renew to continue.',
            code: 'SUBSCRIPTION_EXPIRED',
            expiryDate: activeSub.expiryDate,
        };
    }
    return null;
};

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

        // Attach JWT claims to request for permission checks
        req.role_id = decoded.role_id || null;
        req.role_name = decoded.role_name || null;
        req.permissions = decoded.permissions || [];

        // ── PATH A: Try unified users table first ──────────
        try {
            const unifiedUser = await User.findByPk(decoded.id, {
                include: [
                    { model: Role, as: 'roles' },
                ],
            });

            if (unifiedUser) {
                req.user = unifiedUser;
                req.userType = unifiedUser.user_type;

                if (unifiedUser.user_type === 'SUPER_ADMIN') {
                    console.log("[Auth] Authenticated as Super Admin (unified)");
                    req.superAdmin = unifiedUser;
                    req.permissions = req.permissions.length > 0 ? req.permissions : ['*'];
                    return next();
                }

                if (unifiedUser.user_type === 'ADMIN') {
                    console.log("[Auth] Authenticated as Admin (unified)");
                    req.admin = unifiedUser;
                    req.permissions = req.permissions.length > 0 ? req.permissions : ['*'];

                    const subErr = await checkSubscription(unifiedUser.institution_id);
                    if (subErr) return res.status(403).json(subErr);
                    return next();
                }

                if (unifiedUser.user_type === 'STAFF') {
                    console.log("[Auth] Authenticated as Staff (unified)");

                    // Load staff profile for backward compatibility
                    const staffProfile = await Staff.findOne({ where: { user_id: unifiedUser.id } });
                    if (staffProfile) {
                        req.staff = staffProfile;
                        req.staffId = staffProfile.id;
                        req.admin = staffProfile.admin_id ? await Admin.findByPk(staffProfile.admin_id) : null;
                    }

                    const subErr = await checkSubscription(unifiedUser.institution_id);
                    if (subErr) return res.status(403).json(subErr);
                    return next();
                }
            }
        } catch (e) {
            // users table may not exist yet or model not loaded — fall through to legacy
        }

        // ── PATH B: Legacy fallback — check old tables ─────
        console.log("[Auth] Unified user not found, trying legacy tables...");

        // Check Super Admin
        const superAdmin = await SuperAdmin.findByPk(decoded.id);
        if (superAdmin) {
            console.log("Authenticated as Super Admin (legacy)");
            req.superAdmin = superAdmin;
            req.user = superAdmin;
            req.permissions = req.permissions.length > 0 ? req.permissions : ['*'];
            return next();
        }

        // Check Admin
        const admin = await Admin.findByPk(decoded.id);
        if (admin) {
            console.log("Authenticated as Admin (legacy)");
            req.admin = admin;
            req.user = admin;
            req.permissions = req.permissions.length > 0 ? req.permissions : ['*'];

            const subErr = await checkSubscription(admin.institution_id);
            if (subErr) return res.status(403).json(subErr);
            return next();
        }

        // Check Staff
        const staff = await Staff.findByPk(decoded.id);
        if (staff) {
            console.log("Authenticated as Staff (legacy)");
            req.staff = staff;
            req.staffId = staff.id;
            req.user = staff;

            const subErr = await checkSubscription(staff.institution_id);
            if (subErr) return res.status(403).json(subErr);
            return next();
        }

        // User not found in any table
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

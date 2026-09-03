/**
 * ────────────────────────────────────────────────────────────────
 *  Unified Authentication Controller
 *
 *  Authenticates against the unified `users` table.
 *  Falls back to legacy tables if user not found in `users`.
 * ────────────────────────────────────────────────────────────────
 */

const { User, Role, Permission, Institution, Staff, Department, Admin } = require('../../models');
const { generateToken } = require('../../utils/token');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { decryptStaffData } = require('../../utils/encryptionHelper');
const UserGroup = require('../../models/userGroup');
const StaffDepartment = require('../../models/controls/StaffDepartment');
const UserPermission = require('../../models/userPermission');

// ── Logic questions for Staff 2FA ──────────────────────────
const logicQuestions = [
    { question: "What is 5 + 3?", correctAnswer: "8", options: ["6", "7", "8", "9"] },
    { question: "What color is a banana?", correctAnswer: "Yellow", options: ["Blue", "Yellow", "Green", "Red"] },
    { question: "How many sides does a triangle have?", correctAnswer: "3", options: ["2", "3", "4", "5"] },
    { question: "Which animal is known as the 'King of the Jungle'?", correctAnswer: "Lion", options: ["Tiger", "Lion", "Elephant", "Giraffe"] },
    { question: "What is the fastest land animal?", correctAnswer: "Cheetah", options: ["Cheetah", "Lion", "Horse", "Deer"] },
    { question: "Which animal can fly?", correctAnswer: "Eagle", options: ["Penguin", "Ostrich", "Eagle", "Kangaroo"] },
    { question: "What is 10 + 4?", correctAnswer: "14", options: ["13", "14", "15", "16"] },
    { question: "What is 12 + 3?", correctAnswer: "15", options: ["14", "15", "16", "17"] },
];

const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
const hashAnswer = (answer) => crypto.createHash('sha256').update(answer.toLowerCase()).digest('hex');

/**
 * POST /auth/unified/login
 * Step 1: Verify credentials, return logic question for Staff
 */
exports.login = async (req, res) => {
    const { email, staffID, password } = req.body;
    const identifier = email || staffID;

    if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/StaffID and password are required' });
    }

    try {
        // ── Try unified users table first ──────────────────
        let user = null;
        let userType = null;

        if (staffID) {
            user = await User.findOne({ where: { staff_id_code: staffID } });
        } else if (email) {
            user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        }

        if (user) {
            userType = user.user_type;
        } else {
            // ── Fallback: try legacy tables ────────────────
            if (staffID) {
                const legacyStaff = await Staff.findOne({ where: { staffID } });
                if (legacyStaff) {
                    // Return 409 telling client to migrate
                    return res.status(409).json({
                        error: 'This account needs migration. Please contact support.',
                        code: 'NEEDS_MIGRATION',
                    });
                }
            } else if (email) {
                const legacyAdmin = await Admin.findOne({
                    where: { email: email.toLowerCase().trim() },
                    include: [{ model: Institution, as: 'institution' }],
                });
                if (legacyAdmin) {
                    // Authenticate admin directly from the admins table
                    const validPassword = await bcrypt.compare(password, legacyAdmin.password_hash);
                    if (!validPassword) {
                        return res.status(400).json({ error: 'Invalid credentials' });
                    }

                    // Check account lockout
                    if (legacyAdmin.account_locked_until && legacyAdmin.account_locked_until > new Date()) {
                        const remainingTime = Math.ceil((legacyAdmin.account_locked_until - new Date()) / 60000);
                        return res.status(403).json({
                            error: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
                        });
                    }

                    // Reset lockout on success
                    await legacyAdmin.update({
                        login_attempts: 0,
                        account_locked_until: null,
                        last_failed_attempt: null,
                    });

                    const token = generateToken({
                        id: legacyAdmin.id,
                        email: legacyAdmin.email,
                        institution_id: legacyAdmin.institution_id,
                        user_type: 'ADMIN',
                    });

                    return res.status(200).json({
                        id: legacyAdmin.id,
                        username: legacyAdmin.username,
                        email: legacyAdmin.email,
                        user_type: 'ADMIN',
                        institution: legacyAdmin.institution || legacyAdmin.institution_id,
                        institution_id: legacyAdmin.institution_id,
                        token,
                    });
                }
            }
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // ── Verify password ────────────────────────────────
        if (!(await bcrypt.compare(password, user.password_hash))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // ── Check account lockout ──────────────────────────
        if (user.account_locked_until && user.account_locked_until > new Date()) {
            const remainingTime = Math.ceil((user.account_locked_until - new Date()) / 60000);
            return res.status(403).json({
                error: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
            });
        }

        // ── Patient: direct token (no 2FA) ──────────────────
        if (userType === 'PATIENT') {
            await user.update({ login_attempts: 0, account_locked_until: null, last_login: new Date() });

            const token = generateToken(user);

            return res.status(200).json({
                id: user.id,
                username: user.staff_id_code,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone,
                user_type: 'PATIENT',
                institution_id: user.institution_id,
                token,
            });
        }

        // ── Staff 2FA flow ─────────────────────────────────
        if (userType === 'STAFF') {
            const randomQuestion = logicQuestions[Math.floor(Math.random() * logicQuestions.length)];
            const hashedAnswer = hashAnswer(randomQuestion.correctAnswer);

            await user.update({
                logic_question: randomQuestion.question,
                logic_answer_hash: hashedAnswer,
            });

            return res.status(200).json({
                staff_id_code: user.staff_id_code,
                logic_question: randomQuestion.question,
                options: shuffleArray([...randomQuestion.options]),
                message: "Please select the correct answer to proceed.",
                user_type: 'STAFF',
            });
        }

        // ── Admin / SuperAdmin: direct token ───────────────
        await user.update({ login_attempts: 0, account_locked_until: null, last_login: new Date() });

        const token = generateToken(user);

        // Load full institution object for frontend compat
        let institutionObj = null;
        if (user.institution_id) {
            institutionObj = await Institution.findByPk(user.institution_id);
        }

        res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            user_type: user.user_type,
            institution: institutionObj || user.institution_id,
            institution_id: user.institution_id,
            token,
        });

    } catch (error) {
        console.error('Unified login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * POST /auth/unified/verify-logic
 * Step 2: Verify 2FA logic answer for Staff
 */
exports.verifyLogicAnswer = async (req, res) => {
    const { staffID, staff_id_code, selectedAnswer } = req.body;
    const code = staffID || staff_id_code;

    if (!code || !selectedAnswer) {
        return res.status(400).json({ error: "StaffID and selected answer are required." });
    }

    try {
        const user = await User.findOne({
            where: { staff_id_code: code },
            include: [
                { model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] },
            ],
        });

        if (!user || !user.logic_answer_hash) {
            return res.status(400).json({ error: "No pending logic question found." });
        }

        const hashedSelectedAnswer = hashAnswer(selectedAnswer);
        if (hashedSelectedAnswer !== user.logic_answer_hash) {
            return res.status(400).json({ error: "Incorrect answer. Try again." });
        }

        // Gather permissions from roles
        const rolePermissions = [];
        (user.roles || []).forEach(role => {
            (role.permissions || []).forEach(p => rolePermissions.push(p.name));
        });

        // Gather direct permissions
        const directPerms = await UserPermission.findAll({
            where: { user_id: user.id },
            include: [{ model: Permission, as: 'permission', attributes: ['name'] }],
        });
        directPerms.forEach(p => {
            if (p.permission?.name) rolePermissions.push(p.permission.name);
        });

        const allPermissions = [...new Set(rolePermissions)];

        // Generate token with user_type
        const token = generateToken(user, allPermissions);

        await user.update({
            token,
            logic_question: null,
            logic_answer_hash: null,
            last_login: new Date(),
        });

        // Load staff profile for backward compat
        const staffProfile = await Staff.findOne({ where: { user_id: user.id } });
        let department = null;
        if (staffProfile?.department_id) {
            department = await Department.findByPk(staffProfile.department_id);
        }

        const userData = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            middle_name: user.middle_name,
            phone: user.phone,
            staff_id_code: user.staff_id_code,
            user_type: user.user_type,
            profile_pic: user.profile_pic,
            token,
            permissions: allPermissions,
            role: user.roles?.[0] || null,
            role_id: user.roles?.[0]?.id || null,
            department: department,
            institution: user.institution_id ? await Institution.findByPk(user.institution_id) : null,
            // Legacy compat fields
            staffId: staffProfile?.id || user.id,
            staffID: user.staff_id_code,
        };

        return res.status(200).json({
            message: "Login successful!",
            token,
            user: userData,
        });

    } catch (err) {
        console.error("Error verifying logic answer:", err);
        res.status(500).json({ error: "Server error" });
    }
};

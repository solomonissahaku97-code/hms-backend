/**
 * Auth Controller — handles login, token verification, user lookup.
 * 
 * Staff login uses a 2-step flow:
 *   POST /login → returns logic question
 *   POST /verify-logic → returns JWT token
 * 
 * Admin login is single-step:
 *   POST /admin/login → returns JWT token
 *
 * Table names are lowercase: staffs, admins, institutions, roles, permissions, role_permissions
 * Column names use mixed case: firstName, lastName, staffID, password, institution_id, etc.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const config = require('../config/conf');
const { decryptStaffData } = require('../utils/encryptionHelper');

// ─── Helpers ─────────────────────────────────────────────────────
const shuffleArray = (arr) => arr.sort(() => Math.random() - 0.5);
const hashAnswer = (answer) =>
  crypto.createHash('sha256').update(answer.toLowerCase()).digest('hex');

const LOGIC_QUESTIONS = [
  { q: 'What is 5 + 3?', a: '8', opts: ['6', '7', '8', '9'] },
  { q: 'What color is a banana?', a: 'Yellow', opts: ['Blue', 'Yellow', 'Green', 'Red'] },
  { q: 'How many sides does a triangle have?', a: '3', opts: ['2', '3', '4', '5'] },
  { q: 'Which animal is the King of the Jungle?', a: 'Lion', opts: ['Tiger', 'Lion', 'Elephant', 'Giraffe'] },
  { q: 'What is the fastest land animal?', a: 'Cheetah', opts: ['Cheetah', 'Lion', 'Horse', 'Deer'] },
  { q: 'Which animal can fly?', a: 'Eagle', opts: ['Penguin', 'Ostrich', 'Eagle', 'Kangaroo'] },
  { q: 'What is 10 + 4?', a: '14', opts: ['13', '14', '15', '16'] },
  { q: 'What is 12 + 3?', a: '15', opts: ['14', '15', '16', '17'] },
];

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// ─── Unified Login (staff + admin) ─────────────────────────────────
exports.unifiedLogin = async (req, res) => {
  const { email, staffID, password } = req.body;
  const identifier = email || staffID;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/StaffID and password are required' });
  }

  try {
    let user = null;
    let userType = null;

    if (staffID) {
      const [staff] = await sequelize.query(
        `SELECT s.*, inst.name as institution_name, inst.id as inst_id,
                r.name as role_name, r.id as role_id,
                d.name as department_name, d.id as department_id
         FROM staffs s
         LEFT JOIN institutions inst ON s.institution_id = inst.id
         LEFT JOIN roles r ON s.role_id = r.id
         LEFT JOIN departments d ON s.department_id = d.id
         WHERE s."staffID" = :staffID`,
        { replacements: { staffID }, type: QueryTypes.SELECT }
      );
      if (staff) {
        user = staff;
        userType = 'STAFF';
      }
    } else if (email) {
      const [admin] = await sequelize.query(
        `SELECT a.*, inst.name as institution_name, inst.id as inst_id
         FROM admins a
         LEFT JOIN institutions inst ON a.institution_id = inst.id
         WHERE LOWER(a.email) = LOWER(:email)`,
        { replacements: { email: email.trim() }, type: QueryTypes.SELECT }
      );
      if (admin) {
        user = admin;
        userType = 'ADMIN';
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (userType === 'STAFF') {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const question = LOGIC_QUESTIONS[Math.floor(Math.random() * LOGIC_QUESTIONS.length)];
      const shuffled = shuffleArray([...question.opts]);
      const hashed = hashAnswer(question.a);

      await sequelize.query(
        `UPDATE staffs SET logic_question = :q, logic_answer_hash = :h WHERE id = :id`,
        { replacements: { q: question.q, h: hashed, id: user.id }, type: QueryTypes.UPDATE }
      );

      return res.json({
        staffID: user.staffID,
        logic_question: question.q,
        options: shuffled,
        message: 'Please select the correct answer to proceed.',
        user_type: 'STAFF',
      });
    }

    if (userType === 'ADMIN') {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        institution_id: user.institution_id,
        role: 'admin',
      });

      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        user_type: 'ADMIN',
        institution: { id: user.inst_id, name: user.institution_name },
        token,
      });
    }

    return res.status(400).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Unified login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Staff Login Step 1: Send Logic Question ─────────────────────
exports.staffLogin = async (req, res) => {
  const { staffID, password } = req.body;
  if (!staffID || !password) {
    return res.status(400).json({ error: 'StaffID and password are required' });
  }

  try {
    // Find staff by staffID — table is lowercase "staffs"
    const [staff] = await sequelize.query(
      `SELECT s.*, inst.name as institution_name, inst.id as inst_id,
              r.name as role_name, d.name as department_name
       FROM staffs s
       LEFT JOIN institutions inst ON s.institution_id = inst.id
       LEFT JOIN roles r ON s.role_id = r.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s."staffID" = :staffID`,
      { replacements: { staffID }, type: QueryTypes.SELECT }
    );

    if (!staff) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, staff.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Pick random logic question
    const question = LOGIC_QUESTIONS[Math.floor(Math.random() * LOGIC_QUESTIONS.length)];
    const shuffled = shuffleArray([...question.opts]);
    const hashed = hashAnswer(question.a);

    // Store hashed answer
    await sequelize.query(
      `UPDATE staffs SET logic_question = :q, logic_answer_hash = :h WHERE id = :id`,
      { replacements: { q: question.q, h: hashed, id: staff.id }, type: QueryTypes.UPDATE }
    );

    return res.json({
      staffID: staff.staffID,
      logic_question: question.q,
      options: shuffled,
      message: 'Please select the correct answer to proceed.',
    });
  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Staff Login Step 2: Verify Logic Answer ─────────────────────
exports.verifyLogicAnswer = async (req, res) => {
  const { staffID, selectedAnswer } = req.body;
  if (!staffID || !selectedAnswer) {
    return res.status(400).json({ error: 'StaffID and selected answer are required.' });
  }

  try {
    const [staff] = await sequelize.query(
      `SELECT s.*, inst.name as institution_name, inst.id as inst_id,
              r.name as role_name, r.id as role_id,
              d.name as department_name, d.id as department_id
       FROM staffs s
       LEFT JOIN institutions inst ON s.institution_id = inst.id
       LEFT JOIN roles r ON s.role_id = r.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s."staffID" = :staffID`,
      { replacements: { staffID }, type: QueryTypes.SELECT }
    );

    if (!staff || !staff.logic_answer_hash) {
      return res.status(400).json({ error: 'No pending logic question found.' });
    }

    const hashed = hashAnswer(selectedAnswer);
    if (hashed !== staff.logic_answer_hash) {
      return res.status(400).json({ error: 'Incorrect answer. Try again.' });
    }

    // Get permissions
    const permissions = await sequelize.query(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = :roleId`,
      { replacements: { roleId: staff.role_id }, type: QueryTypes.SELECT }
    );
    const permNames = permissions.map(p => p.name);

    // Generate token
    const token = generateToken({
      id: staff.id,
      staffID: staff.staffID,
      institution_id: staff.institution_id,
      role_id: staff.role_id,
      department_id: staff.department_id,
      permissions: permNames,
    });

    // Clear logic question and update last login
    await sequelize.query(
      `UPDATE staffs SET logic_question = NULL, logic_answer_hash = NULL, 
       last_login = NOW(), token = :token WHERE id = :id`,
      { replacements: { token, id: staff.id }, type: QueryTypes.UPDATE }
    );

    const decryptedStaff = decryptStaffData(staff);

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: decryptedStaff.id,
        staffID: decryptedStaff.staffID,
        firstName: decryptedStaff.firstName,
        lastName: decryptedStaff.lastName,
        middleName: decryptedStaff.middleName,
        email: decryptedStaff.email,
        phone_number: decryptedStaff.phone_number,
        institution_id: decryptedStaff.institution_id,
        institution_name: decryptedStaff.institution_name,
        institution: {
          id: decryptedStaff.institution_id,
          name: decryptedStaff.institution_name,
        },
        role_name: decryptedStaff.role_name,
        role_id: decryptedStaff.role_id,
        department_id: decryptedStaff.department_id,
        department_name: decryptedStaff.department_name,
        department: decryptedStaff.department_id
            ? { id: decryptedStaff.department_id, name: decryptedStaff.department_name }
            : null,
        permissions: permNames,
        token,
      },
    });
  } catch (err) {
    console.error('Verify logic error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Account Lockout Config ───────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Admin Login (single-step with account lockout) ─────────────
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [admin] = await sequelize.query(
      `SELECT a.*, inst.name as institution_name, inst.id as inst_id
       FROM admins a
       LEFT JOIN institutions inst ON a.institution_id = inst.id
       WHERE LOWER(a.email) = LOWER(:email)`,
      { replacements: { email: email.trim() }, type: QueryTypes.SELECT }
    );

    if (!admin) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // ── Check if account is currently locked ──
    if (admin.account_locked_until && new Date(admin.account_locked_until) > new Date()) {
      const remainingMs = new Date(admin.account_locked_until) - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        error: 'Account is locked due to too many failed login attempts.',
        locked: true,
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
        message: `Try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`,
      });
    }

    // ── If lock has expired, clear it before checking password ──
    if (admin.account_locked_until && new Date(admin.account_locked_until) <= new Date()) {
      await sequelize.query(
        `UPDATE admins SET login_attempts = 0, last_failed_attempt = NULL,
         account_locked_until = NULL WHERE id = :id`,
        { replacements: { id: admin.id }, type: QueryTypes.UPDATE }
      );
      admin.login_attempts = 0;
    }

    // ── Verify password ──
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      const newAttempts = (admin.login_attempts || 0) + 1;
      const updates = {
        login_attempts: newAttempts,
        last_failed_attempt: new Date().toISOString(),
        id: admin.id,
      };

      // Lock account after MAX_LOGIN_ATTEMPTS failures
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updates.account_locked_until = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
        await sequelize.query(
          `UPDATE admins SET login_attempts = :login_attempts,
           last_failed_attempt = :last_failed_attempt,
           account_locked_until = :account_locked_until
           WHERE id = :id`,
          { replacements: updates, type: QueryTypes.UPDATE }
        );
        console.log(`[Auth] Admin ${admin.email} locked after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
        return res.status(423).json({
          error: 'Account has been locked due to too many failed login attempts.',
          locked: true,
          retryAfterSeconds: Math.ceil(LOCK_DURATION_MS / 1000),
          message: `Try again in 15 minutes.`,
        });
      }

      // Record the failed attempt (not yet locked)
      await sequelize.query(
        `UPDATE admins SET login_attempts = :login_attempts,
         last_failed_attempt = :last_failed_attempt
         WHERE id = :id`,
        { replacements: updates, type: QueryTypes.UPDATE }
      );

      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      return res.status(400).json({
        error: 'Invalid credentials.',
        loginAttemptsRemaining: remaining,
        message: remaining <= 2
          ? `Warning: ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before account lock.`
          : 'Invalid credentials.',
      });
    }

    // ── Successful login: reset all lockout fields ──
    await sequelize.query(
      `UPDATE admins SET login_attempts = 0, last_failed_attempt = NULL,
       account_locked_until = NULL WHERE id = :id`,
      { replacements: { id: admin.id }, type: QueryTypes.UPDATE }
    );

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      institution_id: admin.institution_id,
      role: 'admin',
    });

    return res.json({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      institution: { id: admin.inst_id, name: admin.institution_name },
      token,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Token Verification ──────────────────────────────────────────
exports.verifyToken = async (req, res) => {
  try {
    return res.json({ valid: true, user: req.user });
  } catch (err) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }
};

// ─── Get User by ID ──────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await sequelize.query(
      `SELECT s.id, s."staffID", s."firstName", s."lastName", s.email,
              s.phone_number, s.profile_pic, s.institution_id, s.role_id,
              s.department_id, s.is_incharge, s.last_login,
              inst.name as institution_name,
              r.name as role_name,
              d.name as department_name
       FROM staffs s
       LEFT JOIN institutions inst ON s.institution_id = inst.id
       LEFT JOIN roles r ON s.role_id = r.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    const decryptedUser = decryptStaffData(user);
    return res.json({ success: true, data: decryptedUser });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Password Reset ──────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [user] = await sequelize.query(
      `SELECT id, password FROM staffs WHERE id = :id`,
      { replacements: { id: userId }, type: QueryTypes.SELECT }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.password) {
      return res.status(400).json({ error: 'Password not set' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Old password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await sequelize.query(
      `UPDATE staffs SET password = :pw WHERE id = :id`,
      { replacements: { pw: hashed, id: userId }, type: QueryTypes.UPDATE }
    );

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Health ──────────────────────────────────────────────────────
exports.health = async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'auth-service', database: 'Connected' });
  } catch (err) {
    res.status(500).json({ status: 'Error', error: err.message });
  }
};

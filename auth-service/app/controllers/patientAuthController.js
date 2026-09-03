/**
 * ────────────────────────────────────────────────────────────────
 *  Patient Auth Controller (auth-service)
 *
 *  Handles patient-specific authentication:
 *   • Login with folder_number + password
 *   • Change password (authenticated)
 *   • Request password reset via SMS OTP
 *   • Verify OTP and set new password
 *
 *  Uses raw SQL against the unified `users` table, consistent
 *  with the existing auth-service pattern.
 * ────────────────────────────────────────────────────────────────
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const config = require('../config/conf');

// ─── SMS helper (uses the monolith's smsService via HTTP) ──────
const http = require('http');
const MONOLITH_URL = process.env.MONOLITH_INTERNAL_URL || 'http://localhost:3000';
const SERVICE_KEY = process.env.SERVICE_AUTH_KEY || process.env.HMS_SERVICE_KEY || '';

async function sendSMS(phone, message) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({ phone, message });
        const url = new URL('/api/v1/notifications/sms/send', MONOLITH_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'X-Service-Key': SERVICE_KEY,
            },
            timeout: 5000,
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ success: res.statusCode < 400, body }));
        });
        req.on('error', (err) => {
            console.error('[PatientAuth] SMS HTTP error:', err.message);
            resolve({ success: false, error: err.message });
        });
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
        req.write(payload);
        req.end();
    });
}

// Fallback: direct Arkesel SMS if monolith proxy unavailable
async function sendSMSDirect(phone, message) {
    if (!process.env.SMS_API_KEY) return { success: false, error: 'SMS_API_KEY not configured' };
    const axios = require('axios');
    try {
        const response = await axios.get('https://sms.arkesel.com/sms/api', {
            params: { action: 'send-sms', api_key: process.env.SMS_API_KEY, to: phone, from: 'Tonitel', sms: message },
        });
        return { success: response.data?.code === 'ok', data: response.data };
    } catch (err) {
        console.error('[PatientAuth] Direct SMS error:', err.message);
        return { success: false, error: err.message };
    }
}

function generateToken(payload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn || '24h' });
}

// ═════════════════════════════════════════════════════════════════
//  POST /login/patient  —  Patient login with folder_number + password
// ═════════════════════════════════════════════════════════════════
exports.patientLogin = async (req, res) => {
    const { staffID, folder_number, password } = req.body;
    const identifier = staffID || folder_number;

    if (!identifier || !password) {
        return res.status(400).json({ error: 'Folder number and password are required' });
    }

    try {
        const [user] = await sequelize.query(
            `SELECT id, email, first_name, last_name, phone, institution_id,
                    staff_id_code, password_hash, user_type, status,
                    login_attempts, account_locked_until, must_change_password
             FROM users
             WHERE staff_id_code = :identifier AND user_type = 'PATIENT'`,
            { replacements: { identifier: identifier.trim() }, type: QueryTypes.SELECT }
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active. Please contact the hospital.' });
        }

        // ── Check lockout ──
        if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
            const remainingMs = new Date(user.account_locked_until) - new Date();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return res.status(423).json({
                error: `Account temporarily locked. Try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`,
                locked: true,
                retryAfterSeconds: Math.ceil(remainingMs / 1000),
            });
        }

        // ── Clear expired lockout ──
        if (user.account_locked_until && new Date(user.account_locked_until) <= new Date()) {
            await sequelize.query(
                `UPDATE users SET login_attempts = 0, account_locked_until = NULL WHERE id = :id`,
                { replacements: { id: user.id }, type: QueryTypes.UPDATE }
            );
        }

        // ── Verify password ──
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            const newAttempts = (user.login_attempts || 0) + 1;
            const updates = { login_attempts: newAttempts, last_failed_attempt: new Date().toISOString(), id: user.id };

            if (newAttempts >= 5) {
                updates.account_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                await sequelize.query(
                    `UPDATE users SET login_attempts = :login_attempts,
                     last_failed_attempt = :last_failed_attempt,
                     account_locked_until = :account_locked_until WHERE id = :id`,
                    { replacements: updates, type: QueryTypes.UPDATE }
                );
                return res.status(423).json({ error: 'Account locked due to too many failed attempts. Try again in 15 minutes.', locked: true });
            }

            await sequelize.query(
                `UPDATE users SET login_attempts = :login_attempts,
                 last_failed_attempt = :last_failed_attempt WHERE id = :id`,
                { replacements: updates, type: QueryTypes.UPDATE }
            );

            const remaining = 5 - newAttempts;
            return res.status(400).json({
                error: 'Invalid credentials.',
                loginAttemptsRemaining: remaining,
            });
        }

        // ── Successful login ──
        await sequelize.query(
            `UPDATE users SET login_attempts = 0, last_failed_attempt = NULL,
             account_locked_until = NULL, last_login = NOW() WHERE id = :id`,
            { replacements: { id: user.id }, type: QueryTypes.UPDATE }
        );

        const token = generateToken({
            id: user.id,
            staff_id_code: user.staff_id_code,
            institution_id: user.institution_id,
            user_type: 'PATIENT',
        });

        return res.json({
            message: 'Login successful!',
            token,
            must_change_password: !!user.must_change_password,
            user: {
                id: user.id,
                folder_number: user.staff_id_code,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone,
                institution_id: user.institution_id,
                user_type: 'PATIENT',
            },
        });
    } catch (err) {
        console.error('[PatientAuth] Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ═════════════════════════════════════════════════════════════════
//  PUT /patient/password  —  Change password (authenticated)
// ═════════════════════════════════════════════════════════════════
exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old password and new password are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const [user] = await sequelize.query(
            `SELECT id, password_hash FROM users WHERE id = :id AND user_type = 'PATIENT'`,
            { replacements: { id: userId }, type: QueryTypes.SELECT }
        );

        if (!user) return res.status(404).json({ error: 'Patient not found' });

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await sequelize.query(
            `UPDATE users SET password_hash = :pw, must_change_password = false WHERE id = :id`,
            { replacements: { pw: hashed, id: userId }, type: QueryTypes.UPDATE }
        );

        return res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('[PatientAuth] Change password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ═════════════════════════════════════════════════════════════════
//  POST /patient/password/reset-request  —  Send SMS OTP
// ═════════════════════════════════════════════════════════════════
exports.requestPasswordReset = async (req, res) => {
    const { folder_number, staffID } = req.body;
    const identifier = folder_number || staffID;

    if (!identifier) {
        return res.status(400).json({ error: 'Folder number is required' });
    }

    try {
        const [user] = await sequelize.query(
            `SELECT id, first_name, phone, staff_id_code FROM users
             WHERE staff_id_code = :identifier AND user_type = 'PATIENT' AND status = 'active'`,
            { replacements: { identifier: identifier.trim() }, type: QueryTypes.SELECT }
        );

        if (!user) {
            // Don't reveal whether the user exists
            return res.json({ message: 'If an account with that folder number exists, an SMS has been sent.' });
        }

        if (!user.phone) {
            return res.status(400).json({ error: 'No phone number on file. Please contact the hospital.' });
        }

        // ── Generate 6-digit OTP ──
        const otp = String(crypto.randomInt(100000, 999999));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await sequelize.query(
            `UPDATE users SET verification_token = :token, verification_expiration = :expires
             WHERE id = :id`,
            { replacements: { token: otpHash, expires: expiresAt.toISOString(), id: user.id }, type: QueryTypes.UPDATE }
        );

        // ── Send OTP via SMS ──
        const message = `Your Tonitel password reset code is: ${otp}\nThis code expires in 10 minutes. Do not share this code with anyone.`;

        // Try monolith proxy first, fall back to direct Arkesel
        let smsResult = await sendSMS(user.phone, message);
        if (!smsResult.success) {
            smsResult = await sendSMSDirect(user.phone, message);
        }

        console.log(`[PatientAuth] Password reset OTP sent to ${user.phone} for ${identifier}`);

        return res.json({
            message: 'If an account with that folder number exists, an SMS has been sent.',
            // In development, include the OTP for testing
            ...(process.env.NODE_ENV === 'development' && { otp, expiresAt }),
        });
    } catch (err) {
        console.error('[PatientAuth] Reset request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ═════════════════════════════════════════════════════════════════
//  POST /patient/password/reset-verify  —  Verify OTP + set new password
// ═════════════════════════════════════════════════════════════════
exports.verifyResetOTP = async (req, res) => {
    const { folder_number, staffID, otp, newPassword } = req.body;
    const identifier = folder_number || staffID;

    if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ error: 'Folder number, OTP, and new password are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const [user] = await sequelize.query(
            `SELECT id, verification_token, verification_expiration FROM users
             WHERE staff_id_code = :identifier AND user_type = 'PATIENT'`,
            { replacements: { identifier: identifier.trim() }, type: QueryTypes.SELECT }
        );

        if (!user || !user.verification_token) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        // ── Check expiry ──
        if (user.verification_expiration && new Date(user.verification_expiration) < new Date()) {
            // Clear expired token
            await sequelize.query(
                `UPDATE users SET verification_token = NULL, verification_expiration = NULL WHERE id = :id`,
                { replacements: { id: user.id }, type: QueryTypes.UPDATE }
            );
            return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
        }

        // ── Verify OTP ──
        const otpValid = await bcrypt.compare(otp, user.verification_token);
        if (!otpValid) {
            return res.status(400).json({ error: 'Invalid reset code' });
        }

        // ── Set new password ──
        const hashed = await bcrypt.hash(newPassword, 10);
        await sequelize.query(
            `UPDATE users SET password_hash = :pw, verification_token = NULL,
             verification_expiration = NULL, login_attempts = 0,
             account_locked_until = NULL, must_change_password = false WHERE id = :id`,
            { replacements: { pw: hashed, id: user.id }, type: QueryTypes.UPDATE }
        );

        return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (err) {
        console.error('[PatientAuth] Verify reset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

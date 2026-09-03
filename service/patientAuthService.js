/**
 * ────────────────────────────────────────────────────────────────
 *  Patient Auth Service
 *
 *  Handles auto-provisioning of patient login credentials when a
 *  patient is registered. Generates a random password, creates a
 *  User record in the unified users table, and sends the
 *  credentials to the patient via SMS.
 * ────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { sendSMS } = require('./smsService');

/**
 * Normalize a phone number to international format with + prefix.
 * - If already starts with +, return as-is
 * - If starts with 0 and length >= 10, assume Ghana (country code +233)
 * - Otherwise, return as-is (user should have included country code)
 */
function normalizePhone(phone) {
    if (!phone) return phone;
    phone = phone.trim();
    if (phone.startsWith('+')) return phone;
    // Ghana default: 0XXXXXXXXX → +233XXXXXXXXX
    if (phone.startsWith('0') && phone.length >= 10) {
        return '+233' + phone.substring(1);
    }
    // If it looks like it already has a country code but no +, add it
    if (/^[1-9]\d{8,14}$/.test(phone)) {
        return '+' + phone;
    }
    return phone;
}

/**
 * Generate a cryptographically secure random password.
 * Format: 2 uppercase + 2 digits + 2 lowercase + 2 special chars (8 chars total)
 * Example: "Kx47mR#9"
 */
function generatePassword(length = 8) {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion
    const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // no i, l, o to avoid confusion
    const digits = '23456789'; // no 0 or 1 to avoid confusion
    const special = '!@#$%&*';

    const password = [
        uppercase[crypto.randomInt(uppercase.length)],
        uppercase[crypto.randomInt(uppercase.length)],
        digits[crypto.randomInt(digits.length)],
        digits[crypto.randomInt(digits.length)],
        lowercase[crypto.randomInt(lowercase.length)],
        lowercase[crypto.randomInt(lowercase.length)],
        special[crypto.randomInt(special.length)],
        special[crypto.randomInt(special.length)],
    ];

    // Shuffle the array using Fisher-Yates
    for (let i = password.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
}

/**
 * Provision a User record for a newly registered patient.
 *
 * @param {Object} patient - The Patient model instance (must have id, first_name, last_name, folder_number, phone, institution_id)
 * @param {Object} transaction - Sequelize transaction (optional but recommended)
 * @returns {{ user: Object, plainPassword: string }} The created User and the plain-text password
 */
async function provisionPatientUser(patient, transaction = null) {
    // Generate password
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Build a synthetic email from folder_number (User.email is NOT NULL + UNIQUE)
    // This lets patients log in with their folder_number via staff_id_code,
    // while satisfying the User model's email constraint.
    const syntheticEmail = `patient_${patient.folder_number}@tonitel.local`;

    // Create the User record
    const user = await User.create(
        {
            institution_id: patient.institution_id,
            email: syntheticEmail,
            password_hash: passwordHash,
            user_type: 'PATIENT',
            staff_id_code: patient.folder_number,   // patients log in with folder_number
            first_name: patient.first_name,
            last_name: patient.last_name,
            phone: patient.phone || null,
            status: 'active',
            must_change_password: true,              // force change on first login
        },
        { transaction }
    );

    return { user, plainPassword };
}

/**
 * Send patient login credentials via SMS.
 *
 * @param {Object} patient - The Patient model instance
 * @param {string} plainPassword - The plain-text generated password
 * @returns {{ success: boolean, error?: string }}
 */
async function sendPatientCredentials(patient, plainPassword) {
    const phone = normalizePhone(patient.phone);
    if (!phone) {
        console.warn(`[PatientAuth] No phone number for patient ${patient.id} — skipping SMS`);
        return { success: false, error: 'No phone number on file' };
    }
    console.log(`[PatientAuth] Sending SMS to ${phone} (raw: ${patient.phone}) for patient ${patient.folder_number}`);

    const message =
        `Welcome to Tonitel!\n\n` +
        `Your patient portal login:\n` +
        `Folder Number: ${patient.folder_number}\n` +
        `Password: ${plainPassword}\n\n` +
        `Download the patient app to view your records, lab results, and prescriptions.\n` +
        `Please change your password after first login.`;

    try {
        const result = await sendSMS(phone, message);
        if (result.success) {
            console.log(`[PatientAuth] Credentials sent to ${phone} for patient ${patient.folder_number}`);
        } else {
            console.error(`[PatientAuth] SMS failed for ${phone}:`, result.error);
        }
        return result;
    } catch (err) {
        console.error(`[PatientAuth] SMS error for ${phone}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    generatePassword,
    provisionPatientUser,
    sendPatientCredentials,
    normalizePhone,
};

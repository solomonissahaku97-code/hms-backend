/**
 * createTestPatient.js
 *
 * Creates a test patient user for mobile app login testing.
 *
 * Usage:
 *   node scripts/createTestPatient.js
 *
 * This will:
 *   1. Check if a test patient already exists
 *   2. If not, create one with known credentials
 *   3. Print the login credentials
 *
 * Credentials:
 *   Folder Number (staffID): TEST-PATIENT-001
 *   Password: Test@1234
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

const TEST_PATIENT = {
    folder_number: 'TEST-PATIENT-001',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+233500000000',
    email: 'patient_test-patient-001@tonitel.local',
    password: 'Test@1234',
    user_type: 'PATIENT',
    status: 'active',
};

async function createTestPatient() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Check if test patient already exists
        const [existing] = await sequelize.query(
            `SELECT id, staff_id_code, first_name, last_name, status
             FROM users
             WHERE staff_id_code = :folder_number AND user_type = 'PATIENT'`,
            { replacements: { folder_number: TEST_PATIENT.folder_number }, type: QueryTypes.SELECT }
        );

        if (existing) {
            console.log('ℹ️  Test patient already exists:');
            console.log(`   ID: ${existing.id}`);
            console.log(`   Name: ${existing.first_name} ${existing.last_name}`);
            console.log(`   Folder: ${existing.staff_id_code}`);
            console.log(`   Status: ${existing.status}`);
            console.log('\n📱 Mobile App Login:');
            console.log(`   Folder Number: ${TEST_PATIENT.folder_number}`);
            console.log(`   Password: ${TEST_PATIENT.password}`);
            await sequelize.close();
            return;
        }

        // Get the first institution to link the patient to
        const [institution] = await sequelize.query(
            `SELECT id FROM institutions LIMIT 1`,
            { type: QueryTypes.SELECT }
        );

        const institutionId = institution?.id || null;

        // Hash password
        const passwordHash = await bcrypt.hash(TEST_PATIENT.password, 10);

        // Create the patient user
        const userId = uuidv4();
        await sequelize.query(
            `INSERT INTO users (
                id, institution_id, email, password_hash, user_type,
                staff_id_code, first_name, last_name, phone,
                status, must_change_password, "createdAt", "updatedAt"
            ) VALUES (
                :id, :institution_id, :email, :password_hash, :user_type,
                :staff_id_code, :first_name, :last_name, :phone,
                :status, :must_change_password, NOW(), NOW()
            )`,
            {
                replacements: {
                    id: userId,
                    institution_id: institutionId,
                    email: TEST_PATIENT.email,
                    password_hash: passwordHash,
                    user_type: TEST_PATIENT.user_type,
                    staff_id_code: TEST_PATIENT.folder_number,
                    first_name: TEST_PATIENT.first_name,
                    last_name: TEST_PATIENT.last_name,
                    phone: TEST_PATIENT.phone,
                    status: TEST_PATIENT.status,
                    must_change_password: false,
                },
                type: QueryTypes.INSERT,
            }
        );

        console.log('✅ Test patient created successfully!\n');
        console.log('📱 Mobile App Login Credentials:');
        console.log('─'.repeat(45));
        console.log(`   Folder Number (staffID): ${TEST_PATIENT.folder_number}`);
        console.log(`   Password:                ${TEST_PATIENT.password}`);
        console.log('─'.repeat(45));
        console.log('\n📋 How to use:');
        console.log('   1. Open the patient mobile app');
        console.log('   2. Enter folder number: TEST-PATIENT-001');
        console.log('   3. Enter password: Test@1234');
        console.log('   4. You will receive FCM push notifications when:');
        console.log('      - Lab results are ready');
        console.log('      - Prescriptions are created/approved');
        console.log('      - Appointments are booked');
        console.log('\n⚠️  Note: If your institution has no patients table entries,');
        console.log('   you may also need to create a Patient record linking to this user.');

        await sequelize.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        await sequelize.close();
        process.exit(1);
    }
}

createTestPatient();

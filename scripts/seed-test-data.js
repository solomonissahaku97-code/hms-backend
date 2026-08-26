/**
 * Seed test data into hms_test for testing the unified users migration.
 * Run with: DB_NAME=hms_test node scripts/seed-test-data.js
 */
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

const log = (msg) => console.log(`[SEED] ${msg}`);

async function run() {
    const transaction = await sequelize.transaction();

    try {
        // 1. Create test institution
        log('Creating test institution...');
        const [institution] = await sequelize.query(
            `INSERT INTO institutions (id, name, email, address, contact, country, region, serial_code, "createdAt", "updatedAt")
             VALUES (
                 'a0000000-0000-0000-0000-000000000001',
                 'Test Hospital',
                 'admin@testhospital.com',
                 '123 Test Street',
                 '+2348000000001',
                 'Nigeria',
                 'Lagos',
                 'TEST-001',
                 NOW(), NOW()
             ) ON CONFLICT (id) DO NOTHING RETURNING id`,
            { type: QueryTypes.INSERT, transaction }
        );
        const instId = institution?.[0]?.id || 'a0000000-0000-0000-0000-000000000001';
        log(`  ✓ Institution: ${instId}`);

        // 2. Create test roles
        log('Creating test roles...');
        const [role1] = await sequelize.query(
            `INSERT INTO roles (id, name, description)
             VALUES ('b0000000-0000-0000-0000-000000000001', 'Doctor', 'Medical Doctor')
             ON CONFLICT (id) DO NOTHING RETURNING id`,
            { type: QueryTypes.INSERT, transaction }
        );
        const [role2] = await sequelize.query(
            `INSERT INTO roles (id, name, description)
             VALUES ('b0000000-0000-0000-0000-000000000002', 'Nurse', 'Registered Nurse')
             ON CONFLICT (id) DO NOTHING RETURNING id`,
            { type: QueryTypes.INSERT, transaction }
        );
        log('  ✓ Roles created');

        // 3. Create test permissions
        log('Creating test permissions...');
        const [perm1] = await sequelize.query(
            `INSERT INTO permissions (id, name, description, "createdAt", "updatedAt")
             VALUES ('c0000000-0000-0000-0000-000000000001', 'view_patients', 'View patient records', NOW(), NOW())
             ON CONFLICT (id) DO NOTHING RETURNING id`,
            { type: QueryTypes.INSERT, transaction }
        );
        const [perm2] = await sequelize.query(
            `INSERT INTO permissions (id, name, description, "createdAt", "updatedAt")
             VALUES ('c0000000-0000-0000-0000-000000000002', 'edit_records', 'Edit medical records', NOW(), NOW())
             ON CONFLICT (id) DO NOTHING RETURNING id`,
            { type: QueryTypes.INSERT, transaction }
        );
        log('  ✓ Permissions created');

        // 4. Create test superadmin
        log('Creating test superadmin...');
        await sequelize.query(
            `INSERT INTO superadmin (id, username, email, password_hash, role_manager, "createdAt", "updatedAt")
             VALUES (
                 'd0000000-0000-0000-0000-000000000001',
                 'testsuperadmin',
                 'superadmin@test.com',
                 '$2a$10$fakeHashForTesting1234567890123456789012345',
                 'superadmin',
                 NOW(), NOW()
             ) ON CONFLICT (id) DO NOTHING`,
            { type: QueryTypes.INSERT, transaction }
        );
        log('  ✓ SuperAdmin created');

        // 5. Create test admin
        log('Creating test admin...');
        await sequelize.query(
            `INSERT INTO admins (id, username, email, password_hash, institution_id, role_manager, "createdAt", "updatedAt")
             VALUES (
                 'e0000000-0000-0000-0000-000000000001',
                 'testadmin',
                 'admin@test.com',
                 '$2a$10$fakeHashForTesting1234567890123456789012345',
                 '${instId}',
                 'admin',
                 NOW(), NOW()
             ) ON CONFLICT (id) DO NOTHING`,
            { type: QueryTypes.INSERT, transaction }
        );
        log('  ✓ Admin created');

        // 6. Create test staff (with role and permissions)
        log('Creating test staff...');
        const staffIds = [];
        const staffData = [
            {
                id: 'f0000000-0000-0000-0000-000000000001',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@hospital.com',
                staffID: 'STF001',
                roleId: 'b0000000-0000-0000-0000-000000000001', // Doctor
            },
            {
                id: 'f0000000-0000-0000-0000-000000000002',
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@hospital.com',
                staffID: 'STF002',
                roleId: 'b0000000-0000-0000-0000-000000000002', // Nurse
            },
            {
                id: 'f0000000-0000-0000-0000-000000000003',
                firstName: 'Bob',
                lastName: 'Wilson',
                email: 'bob.wilson@hospital.com',
                staffID: 'STF003',
                roleId: null, // No role assigned
            },
        ];

        for (const s of staffData) {
            await sequelize.query(
                `INSERT INTO staffs (id, "firstName", "lastName", email, password, institution_id, "staffID", role_id, role_manager, created_at)
                 VALUES (
                     '${s.id}', '${s.firstName}', '${s.lastName}', '${s.email}',
                     '$2a$10$fakeHashForTesting1234567890123456789012345',
                     '${instId}', '${s.staffID}', ${s.roleId ? `'${s.roleId}'` : 'NULL'},
                     'staff', NOW()
                 ) ON CONFLICT (id) DO NOTHING`,
                { type: QueryTypes.INSERT, transaction }
            );
            staffIds.push(s.id);
            log(`  ✓ Staff: ${s.firstName} ${s.lastName} (${s.staffID})`);
        }

        // 7. Create permissions for one staff member (John Doe)
        log('Creating user_permissions for staff...');
        await sequelize.query(
            `INSERT INTO user_permission (id, staff_id, permission_id, "PermissionId", "createdAt", "updatedAt")
             VALUES (
                 'a1000000-0000-0000-0000-000000000001',
                 '${staffIds[0]}',
                 'c0000000-0000-0000-0000-000000000001',
                 'c0000000-0000-0000-0000-000000000001',
                 NOW(), NOW()
             ) ON CONFLICT (id) DO NOTHING`,
            { type: QueryTypes.INSERT, transaction }
        );
        await sequelize.query(
            `INSERT INTO user_permission (id, staff_id, permission_id, "PermissionId", "createdAt", "updatedAt")
             VALUES (
                 'a1000000-0000-0000-0000-000000000002',
                 '${staffIds[0]}',
                 'c0000000-0000-0000-0000-000000000002',
                 'c0000000-0000-0000-0000-000000000002',
                 NOW(), NOW()
             ) ON CONFLICT (id) DO NOTHING`,
            { type: QueryTypes.INSERT, transaction }
        );
        log('  ✓ User permissions created for John Doe');

        await transaction.commit();

        // Print summary
        log('');
        log('═══════════════════════════════════════════');
        log('  Seed Data Summary');
        log('═══════════════════════════════════════════');

        const counts = await Promise.all([
            sequelize.query('SELECT COUNT(*) as count FROM institutions', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM superadmin', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM admins', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM staffs', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM roles', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM permissions', { type: QueryTypes.SELECT }),
            sequelize.query('SELECT COUNT(*) as count FROM user_permission', { type: QueryTypes.SELECT }),
        ]);

        log(`  institutions:  ${counts[0][0].count}`);
        log(`  superadmin:    ${counts[1][0].count}`);
        log(`  admins:        ${counts[2][0].count}`);
        log(`  staffs:        ${counts[3][0].count}`);
        log(`  roles:         ${counts[4][0].count}`);
        log(`  permissions:   ${counts[5][0].count}`);
        log(`  user_permission: ${counts[6][0].count}`);
        log('═══════════════════════════════════════════');
        log('  Seed complete!');

    } catch (error) {
        await transaction.rollback();
        console.error('[SEED] ❌ FAILED:', error);
        process.exit(1);
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[SEED] Fatal error:', err);
        process.exit(1);
    });

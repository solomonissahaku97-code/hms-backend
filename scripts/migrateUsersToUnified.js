/**
 * ────────────────────────────────────────────────────────────────
 *  DATA MIGRATION: Admin / SuperAdmin / Staff → Unified users
 *
 *  Safe to run multiple times (idempotent — skips already-migrated
 *  records by checking user_id_mapping).
 *
 *  Run with:  node scripts/migrateUsersToUnified.js
 * ────────────────────────────────────────────────────────────────
 */

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// ── Helpers ─────────────────────────────────────────────────────
const log = (msg) => console.log(`[USER_MIGRATION] ${msg}`);
const warn = (msg) => console.warn(`[USER_MIGRATION ⚠️] ${msg}`);

async function run() {
    const transaction = await sequelize.transaction();
    let migrated = { superadmins: 0, admins: 0, staff: 0, roles: 0, permissions: 0 };

    try {
        // ──────────────────────────────────────────────────────
        // 1. Migrate SuperAdmins
        // ──────────────────────────────────────────────────────
        log('Migrating SuperAdmins...');

        const superAdmins = await sequelize.query(
            `SELECT * FROM superadmin`,
            { type: QueryTypes.SELECT, transaction }
        );

        for (const sa of superAdmins) {
            // Check if already migrated
            const existing = await sequelize.query(
                `SELECT 1 FROM user_id_mapping WHERE old_table = 'superadmin' AND old_id = :id`,
                { replacements: { id: sa.id }, type: QueryTypes.SELECT, transaction }
            );

            if (existing.length > 0) {
                log(`  SuperAdmin ${sa.email} already migrated, skipping`);
                continue;
            }

            // Insert into users
            const [[newUser]] = await sequelize.query(
                `INSERT INTO users (
                    id, email, username, password_hash, user_type, status,
                    token, token_expiration, last_login, role_manager,
                    "createdAt", "updatedAt"
                ) VALUES (
                    :id, :email, :username, :password_hash, 'SUPER_ADMIN', 'active',
                    :token, NULL, :last_login, 'superadmin',
                    NOW(), NOW()
                ) RETURNING id`,
                {
                    replacements: {
                        id: sa.id,  // Reuse the same UUID for simplicity
                        email: sa.email,
                        username: sa.username,
                        password_hash: sa.password_hash,
                        token: sa.token || null,
                        last_login: sa.last_login || null,
                    },
                    type: QueryTypes.INSERT,
                    transaction,
                }
            );

            // Record mapping
            await sequelize.query(
                `INSERT INTO user_id_mapping (id, old_table, old_id, new_user_id) VALUES (gen_random_uuid(), 'superadmin', :old_id, :new_id)`,
                { replacements: { old_id: sa.id, new_id: newUser.id }, type: QueryTypes.INSERT, transaction }
            );

            migrated.superadmins++;
            log(`  ✓ Migrated SuperAdmin: ${sa.email}`);
        }

        // ──────────────────────────────────────────────────────
        // 2. Migrate Admins
        // ──────────────────────────────────────────────────────
        log('Migrating Admins...');

        const admins = await sequelize.query(
            `SELECT * FROM admins`,
            { type: QueryTypes.SELECT, transaction }
        );

        for (const admin of admins) {
            const existing = await sequelize.query(
                `SELECT 1 FROM user_id_mapping WHERE old_table = 'admins' AND old_id = :id`,
                { replacements: { id: admin.id }, type: QueryTypes.SELECT, transaction }
            );

            if (existing.length > 0) {
                log(`  Admin ${admin.email} already migrated, skipping`);
                continue;
            }

            const [[newUser]] = await sequelize.query(
                `INSERT INTO users (
                    id, email, username, password_hash, user_type, status,
                    institution_id, verification_token, verification_expiration,
                    login_attempts, last_failed_attempt, account_locked_until,
                    role_manager, "createdAt", "updatedAt"
                ) VALUES (
                    :id, :email, :username, :password_hash, 'ADMIN', 'active',
                    :institution_id, :verification_token, :verification_expiration,
                    :login_attempts, :last_failed_attempt, :account_locked_until,
                    'admin', NOW(), NOW()
                ) RETURNING id`,
                {
                    replacements: {
                        id: admin.id,
                        email: admin.email,
                        username: admin.username,
                        password_hash: admin.password_hash,
                        institution_id: admin.institution_id,
                        verification_token: admin.verification_token || null,
                        verification_expiration: admin.token_expiration || null,
                        login_attempts: admin.login_attempts || 0,
                        last_failed_attempt: admin.last_failed_attempt || null,
                        account_locked_until: admin.account_locked_until || null,
                    },
                    type: QueryTypes.INSERT,
                    transaction,
                }
            );

            await sequelize.query(
                `INSERT INTO user_id_mapping (id, old_table, old_id, new_user_id) VALUES (gen_random_uuid(), 'admins', :old_id, :new_id)`,
                { replacements: { old_id: admin.id, new_id: newUser.id }, type: QueryTypes.INSERT, transaction }
            );

            migrated.admins++;
            log(`  ✓ Migrated Admin: ${admin.email}`);
        }

        // ──────────────────────────────────────────────────────
        // 3. Migrate Staff
        // ──────────────────────────────────────────────────────
        log('Migrating Staff...');

        const staffList = await sequelize.query(
            `SELECT * FROM staffs`,
            { type: QueryTypes.SELECT, transaction }
        );

        for (const staff of staffList) {
            const existing = await sequelize.query(
                `SELECT 1 FROM user_id_mapping WHERE old_table = 'staffs' AND old_id = :id`,
                { replacements: { id: staff.id }, type: QueryTypes.SELECT, transaction }
            );

            if (existing.length > 0) {
                log(`  Staff ${staff.staffID} already migrated, skipping`);
                continue;
            }

            // Determine status from token / account state
            const status = 'active';

            const [[newUser]] = await sequelize.query(
                `INSERT INTO users (
                    id, email, username, first_name, middle_name, last_name,
                    phone, password_hash, user_type, status,
                    institution_id, staff_id_code,
                    token, token_expiration, last_login,
                    profile_pic, logic_question, logic_answer_hash,
                    role_manager, "createdAt", "updatedAt"
                ) VALUES (
                    :id, :email, NULL, :first_name, :middle_name, :last_name,
                    :phone, :password, 'STAFF', :status,
                    :institution_id, :staff_id_code,
                    :token, :token_expiration, :last_login,
                    :profile_pic, :logic_question, :logic_answer_hash,
                    'staff', NOW(), NOW()
                ) RETURNING id`,
                {
                    replacements: {
                        id: staff.id,
                        email: staff.email,
                        first_name: staff.firstName,
                        middle_name: staff.middleName || null,
                        last_name: staff.lastName,
                        phone: staff.phone_number || null,
                        password: staff.password,
                        status,
                        institution_id: staff.institution_id,
                        staff_id_code: staff.staffID || null,
                        token: staff.token || null,
                        token_expiration: staff.token_expiration || null,
                        last_login: staff.last_login || null,
                        profile_pic: staff.profile_pic || null,
                        logic_question: staff.logic_question || null,
                        logic_answer_hash: staff.logic_answer_hash || null,
                    },
                    type: QueryTypes.INSERT,
                    transaction,
                }
            );

            // Record mapping
            await sequelize.query(
                `INSERT INTO user_id_mapping (id, old_table, old_id, new_user_id) VALUES (gen_random_uuid(), 'staffs', :old_id, :new_id)`,
                { replacements: { old_id: staff.id, new_id: newUser.id }, type: QueryTypes.INSERT, transaction }
            );

            // Link staffs.user_id back to users
            await sequelize.query(
                `UPDATE staffs SET user_id = :user_id WHERE id = :staff_id`,
                { replacements: { user_id: newUser.id, staff_id: staff.id }, type: QueryTypes.UPDATE, transaction }
            );

            // ── Migrate staff's role (uses savepoint) ──────
            if (staff.role_id) {
                const spName = `sp_role_${staff.id.replace(/-/g, '')}`;
                try {
                    await sequelize.query(`SAVEPOINT "${spName}"`, { transaction });
                    await sequelize.query(
                        `INSERT INTO user_roles (id, user_id, role_id) VALUES (gen_random_uuid(), :user_id, :role_id)
                         ON CONFLICT DO NOTHING`,
                        { replacements: { user_id: newUser.id, role_id: staff.role_id }, type: QueryTypes.INSERT, transaction }
                    );
                    migrated.roles++;
                    await sequelize.query(`RELEASE SAVEPOINT "${spName}"`, { transaction });
                } catch (e) {
                    warn(`  Could not migrate role for staff ${staff.staffID}: ${e.message}`);
                    await sequelize.query(`ROLLBACK TO SAVEPOINT "${spName}"`, { transaction });
                }
            }

            // ── Migrate staff's direct permissions (uses savepoint) ──
            if (staff.id) {
                const spName = `sp_perms_${staff.id.replace(/-/g, '')}`;
                try {
                    await sequelize.query(`SAVEPOINT "${spName}"`, { transaction });
                    const directPerms = await sequelize.query(
                        `SELECT permission_id FROM user_permission WHERE staff_id = :staff_id`,
                        { replacements: { staff_id: staff.id }, type: QueryTypes.SELECT, transaction }
                    );

                    for (const perm of directPerms) {
                        await sequelize.query(
                            `INSERT INTO user_permissions (id, user_id, permission_id) VALUES (gen_random_uuid(), :user_id, :perm_id)
                             ON CONFLICT DO NOTHING`,
                            { replacements: { user_id: newUser.id, perm_id: perm.permission_id }, type: QueryTypes.INSERT, transaction }
                        );
                        migrated.permissions++;
                    }
                    await sequelize.query(`RELEASE SAVEPOINT "${spName}"`, { transaction });
                } catch (e) {
                    warn(`  Could not migrate permissions for staff ${staff.staffID}: ${e.message}`);
                    await sequelize.query(`ROLLBACK TO SAVEPOINT "${spName}"`, { transaction });
                }
            }

            migrated.staff++;
            log(`  ✓ Migrated Staff: ${staff.staffID}`);
        }

        // ──────────────────────────────────────────────────────
        // 4. Summary
        // ──────────────────────────────────────────────────────
        await transaction.commit();

        log('═══════════════════════════════════════════');
        log('  Migration Complete!');
        log(`  SuperAdmins migrated: ${migrated.superadmins}`);
        log(`  Admins migrated:      ${migrated.admins}`);
        log(`  Staff migrated:       ${migrated.staff}`);
        log(`  Roles linked:         ${migrated.roles}`);
        log(`  Permissions linked:   ${migrated.permissions}`);

        // ── Verification counts ─────────────────────────────
        const [userCount] = await sequelize.query(`SELECT COUNT(*) as count FROM users`);
        const [adminCount] = await sequelize.query(`SELECT COUNT(*) as count FROM admins`);
        const [saCount] = await sequelize.query(`SELECT COUNT(*) as count FROM superadmin`);
        const [staffCount] = await sequelize.query(`SELECT COUNT(*) as count FROM staffs`);

        log('');
        log('  ── Verification ──');
        log(`  users table:     ${userCount[0].count}`);
        log(`  admins table:    ${adminCount[0].count}`);
        log(`  superadmin table: ${saCount[0].count}`);
        log(`  staffs table:    ${staffCount[0].count}`);
        log('═══════════════════════════════════════════');

    } catch (error) {
        await transaction.rollback();
        console.error('[USER_MIGRATION] ❌ FAILED — rolled back:', error);
        process.exit(1);
    }
}

run()
    .then(() => {
        log('Done.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[USER_MIGRATION] Fatal error:', err);
        process.exit(1);
    });

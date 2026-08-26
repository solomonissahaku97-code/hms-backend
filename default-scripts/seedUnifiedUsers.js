/**
 * Seed a default SuperAdmin in the unified users table.
 * Idempotent — skips if a SUPER_ADMIN user already exists.
 *
 * Run with:  node default-scripts/seedUnifiedUsers.js
 */

const bcrypt = require('bcryptjs');
const { User } = require('../models');

const seedUnifiedUsers = async () => {
    try {
        const existing = await User.findOne({ where: { user_type: 'SUPER_ADMIN' } });

        if (existing) {
            console.log('Unified SuperAdmin already exists, skipping.');
            return;
        }

        const passwordHash = await bcrypt.hash('superadmin123', 12);

        await User.create({
            username: 'superadmin',
            email: 'superadmin@tonitel.com',
            first_name: null,
            last_name: null,
            password_hash: passwordHash,
            user_type: 'SUPER_ADMIN',
            status: 'active',
            role_manager: 'superadmin',
        });

        console.log('✅ Default Unified SuperAdmin created:');
        console.log('   Email:    superadmin@tonitel.com');
        console.log('   Password: superadmin123');
        console.log('   ⚠️  Change this password in production!');
    } catch (error) {
        console.error('Error seeding unified users:', error);
    }
};

module.exports = seedUnifiedUsers;

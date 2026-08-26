'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Helper: check if a table exists
        const tableExists = async (name) => {
            const [r] = await queryInterface.sequelize.query(
                `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}') as exists`
            );
            return r[0].exists;
        };

        // Helper: check if a column exists
        const columnExists = async (table, col) => {
            const [r] = await queryInterface.sequelize.query(
                `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`
            );
            return r.length > 0;
        };

        // ── 1. Create users table ──────────────────────────
        if (!await tableExists('users')) {
            await queryInterface.createTable('users', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true,
                },
                institution_id: {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: { model: 'institutions', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
                username: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                },
                first_name: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                middle_name: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                last_name: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                email: {
                    type: Sequelize.STRING(255),
                    allowNull: false,
                    unique: true,
                },
                phone: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                password_hash: {
                    type: Sequelize.STRING(255),
                    allowNull: false,
                },
                staff_id_code: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    unique: true,
                },
                token: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                token_expiration: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                last_login: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                user_type: {
                    type: Sequelize.STRING(20),
                    allowNull: false,
                    defaultValue: 'STAFF',
                },
                profile_pic: {
                    type: Sequelize.STRING(512),
                    allowNull: true,
                },
                status: {
                    type: Sequelize.STRING(20),
                    defaultValue: 'active',
                },
                login_attempts: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                },
                last_failed_attempt: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                account_locked_until: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                verification_token: {
                    type: Sequelize.STRING(6),
                    allowNull: true,
                },
                verification_expiration: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                logic_question: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                logic_answer_hash: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                role_manager: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                },
                createdAt: {
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('NOW()'),
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('NOW()'),
                },
            });
            console.log('ℹ️  Created users table');
        } else {
            console.log('ℹ️  users table already exists — skipping');
        }

        // ── 2. Create user_roles join table ────────────────
        if (!await tableExists('user_roles')) {
            await queryInterface.createTable('user_roles', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true,
                },
                user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'CASCADE',
                },
                role_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'roles', key: 'id' },
                    onDelete: 'CASCADE',
                },
            });

            await queryInterface.addIndex('user_roles', {
                unique: true,
                fields: ['user_id', 'role_id'],
            });
            console.log('ℹ️  Created user_roles table');
        } else {
            console.log('ℹ️  user_roles table already exists — skipping');
        }

        // ── 3. Create user_permissions join table ──────────
        if (!await tableExists('user_permissions')) {
            await queryInterface.createTable('user_permissions', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true,
                },
                user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'CASCADE',
                },
                permission_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'permissions', key: 'id' },
                    onDelete: 'CASCADE',
                },
            });

            await queryInterface.addIndex('user_permissions', {
                unique: true,
                fields: ['user_id', 'permission_id'],
            });
            console.log('ℹ️  Created user_permissions table');
        } else {
            console.log('ℹ️  user_permissions table already exists — skipping');
        }

        // ── 4. Create user_id_mapping table ────────────────
        if (!await tableExists('user_id_mapping')) {
            await queryInterface.createTable('user_id_mapping', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true,
                },
                old_table: {
                    type: Sequelize.STRING(50),
                    allowNull: false,
                },
                old_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                },
                new_user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                },
                migrated_at: {
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('NOW()'),
                },
            });

            await queryInterface.addIndex('user_id_mapping', {
                unique: true,
                fields: ['old_table', 'old_id'],
            });
            console.log('ℹ️  Created user_id_mapping table');
        } else {
            console.log('ℹ️  user_id_mapping table already exists — skipping');
        }

        // ── 5. Add user_id to staffs table ─────────────────
        if (!await columnExists('staffs', 'user_id')) {
            await queryInterface.addColumn('staffs', 'user_id', {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            });
            console.log('ℹ️  Added user_id column to staffs');
        } else {
            console.log('ℹ️  staffs.user_id column already exists — skipping');
        }
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('staffs', 'user_id');
        await queryInterface.dropTable('user_id_mapping');
        await queryInterface.dropTable('user_permissions');
        await queryInterface.dropTable('user_roles');
        await queryInterface.dropTable('users');
    },
};

'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('lab_referrals', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            referral_number: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            referring_institution_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'institutions', key: 'id' },
                onDelete: 'CASCADE'
            },
            receiving_institution_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'institutions', key: 'id' },
                onDelete: 'CASCADE'
            },
            patient_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'patients', key: 'id' },
                onDelete: 'CASCADE'
            },
            visit_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'visits', key: 'id' },
                onDelete: 'SET NULL'
            },
            requested_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'staffs', key: 'id' },
                onDelete: 'SET NULL'
            },
            department_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'departments', key: 'id' },
                onDelete: 'SET NULL'
            },
            referral_date: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            status: {
                type: Sequelize.ENUM(
                    'pending',
                    'sent',
                    'accepted',
                    'sample_collected',
                    'processing',
                    'result_ready',
                    'result_received',
                    'completed',
                    'rejected',
                    'cancelled'
                ),
                allowNull: false,
                defaultValue: 'pending'
            },
            clinical_reason: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            clinical_notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            expected_result_date: {
                type: Sequelize.DATE,
                allowNull: true
            },
            result_received_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('lab_referral_items', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            referral_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'lab_referrals', key: 'id' },
                onDelete: 'CASCADE'
            },
            template_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'lab_test_templates', key: 'id' },
                onDelete: 'CASCADE'
            },
            request_notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            result_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'lab_test_results', key: 'id' },
                onDelete: 'SET NULL'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.addColumn('lab_test_results', 'referral_id', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'lab_referrals', key: 'id' },
            onDelete: 'SET NULL'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('lab_test_results', 'referral_id');
        await queryInterface.dropTable('lab_referral_items');
        await queryInterface.dropTable('lab_referrals');
    }
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable('patient_notifications', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          comment: 'The users table ID of the patient',
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        body: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        type: {
          type: Sequelize.STRING(50),
          allowNull: true,
          defaultValue: 'general',
          comment: 'appointment, lab_result, prescription, general',
        },
        data: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        is_read: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
        },
      });

      await queryInterface.addIndex('patient_notifications', ['user_id']);
      await queryInterface.addIndex('patient_notifications', ['user_id', 'is_read']);
      await queryInterface.addIndex('patient_notifications', ['created_at']);
      console.log('  ✓ Created patient_notifications table');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⊘ patient_notifications table already exists');
      } else {
        throw err;
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patient_notifications');
  },
};

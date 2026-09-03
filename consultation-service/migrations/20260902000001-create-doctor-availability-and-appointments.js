'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ── Doctor Availability ──────────────────────────────────
    await queryInterface.createTable('doctor_availability', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      department_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      day_of_week: {
        type: Sequelize.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        allowNull: false,
      },
      start_time: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      end_time: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      slot_duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      break_start: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      break_end: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('doctor_availability', ['doctor_id']);
    await queryInterface.addIndex('doctor_availability', ['institution_id']);
    await queryInterface.addIndex('doctor_availability', ['department_id']);
    await queryInterface.addIndex('doctor_availability', ['day_of_week']);
    await queryInterface.addIndex('doctor_availability', ['doctor_id', 'institution_id', 'department_id']);

    // ── Patient Appointments ─────────────────────────────────
    await queryInterface.createTable('patient_appointments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      department_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      appointment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      appointment_time: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      slot_duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled'),
        defaultValue: 'scheduled',
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cancelled_by: {
        type: Sequelize.ENUM('patient', 'doctor', 'admin'),
        allowNull: true,
      },
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('patient_appointments', ['patient_id']);
    await queryInterface.addIndex('patient_appointments', ['doctor_id']);
    await queryInterface.addIndex('patient_appointments', ['institution_id']);
    await queryInterface.addIndex('patient_appointments', ['department_id']);
    await queryInterface.addIndex('patient_appointments', ['appointment_date']);
    await queryInterface.addIndex('patient_appointments', ['status']);
    await queryInterface.addIndex('patient_appointments', ['token'], { unique: true });
    // Composite unique constraint for double-booking prevention
    await queryInterface.addIndex('patient_appointments', ['doctor_id', 'appointment_date', 'appointment_time'], {
      unique: true,
      where: { status: { [Sequelize.Op.in]: ['scheduled', 'confirmed'] } },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('patient_appointments');
    await queryInterface.dropTable('doctor_availability');
  },
};

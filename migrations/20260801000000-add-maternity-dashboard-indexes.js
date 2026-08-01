'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const indexesToCreate = [
      { table: 'visits', fields: ['institution_id', 'status', 'department_id'], name: 'idx_visits_institution_status_department' },
      { table: 'visits', fields: ['institution_id', 'status'], name: 'idx_visits_institution_status' },
      { table: 'visits', fields: ['department_id'], name: 'idx_visits_department_id' },
      { table: 'delivery_register', fields: ['institution_id', 'date_of_delivery'], name: 'idx_delivery_register_institution_date' },
      { table: 'anc_records', fields: ['institution_id', 'createdAt'], name: 'idx_anc_records_institution_created' },
      { table: 'appointments', fields: ['institution_id', 'appointment_date', 'status'], name: 'idx_appointments_institution_date_status' },
      { table: 'partographs', fields: ['visit_id', 'record_time'], name: 'idx_partographs_visit_record_time' }
    ];

    for (const idx of indexesToCreate) {
      try {
        await queryInterface.removeIndex(idx.table, idx.name);
      } catch (e) {
        // Index may not exist yet, ignore
      }
      await queryInterface.addIndex(idx.table, idx.fields, { name: idx.name });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const indexNames = [
      'idx_visits_institution_status_department',
      'idx_visits_institution_status',
      'idx_visits_department_id',
      'idx_delivery_register_institution_date',
      'idx_anc_records_institution_created',
      'idx_appointments_institution_date_status',
      'idx_partographs_visit_record_time'
    ];

    const tables = ['visits', 'visits', 'visits', 'delivery_register', 'anc_records', 'appointments', 'partographs'];

    for (let i = 0; i < indexNames.length; i++) {
      try {
        await queryInterface.removeIndex(tables[i], indexNames[i]);
      } catch (e) {
        // Index may not exist, ignore
      }
    }
  }
};

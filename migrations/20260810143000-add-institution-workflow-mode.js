'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('institutions');

    if (!tableDescription.workflow_mode) {
      await queryInterface.addColumn('institutions', 'workflow_mode', {
        type: Sequelize.ENUM('full', 'lab_only', 'opd_only', 'records_lab'),
        allowNull: true,
        defaultValue: 'full',
        comment:
          'Workflow mode: full=all modules, lab_only=lab only, opd_only=outpatient only, records_lab=records + lab'
      });
    }
  },

  down: async (queryInterface) => {
    const tableDescription = await queryInterface.describeTable('institutions');

    if (tableDescription.workflow_mode) {
      await queryInterface.removeColumn('institutions', 'workflow_mode');
    }
  }
};
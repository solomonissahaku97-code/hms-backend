'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists (idempotent)
    const [exists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'institution_lab_reference_ranges') as exists`
    );
    if (exists[0].exists) {
      console.log('ℹ️  institution_lab_reference_ranges table already exists — skipping');
      return;
    }

    await queryInterface.createTable('institution_lab_reference_ranges', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'institutions', key: 'id' },
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'lab_test_templates', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Link to the lab test template',
      },
      test_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Display name of the test/parameter, e.g. Hemoglobin',
      },
      gender: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'All',
        comment: 'Male, Female, or All',
      },
      age_min: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Minimum age for this range (years)',
      },
      age_max: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Maximum age for this range (years)',
      },
      min_value: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Numeric lower bound',
      },
      max_value: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Numeric upper bound',
      },
      reference_range: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable range, e.g. 13 - 17',
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional description or clinical context',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('institution_lab_reference_ranges', ['institution_id']);
    await queryInterface.addIndex('institution_lab_reference_ranges', ['template_id']);
    await queryInterface.addIndex('institution_lab_reference_ranges', ['test_name']);
    await queryInterface.addIndex('institution_lab_reference_ranges', ['institution_id', 'test_name']);
    await queryInterface.addIndex('institution_lab_reference_ranges', ['institution_id', 'template_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('institution_lab_reference_ranges');
  },
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ─── Medications ──────────────────────────────────────────
    await queryInterface.createTable('medications', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      generic_name: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      brand_name: { type: Sequelize.STRING(255), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      category: { type: Sequelize.STRING(100), allowNull: true },
      form: { type: Sequelize.STRING(50), allowNull: true },
      strength: { type: Sequelize.STRING(50), allowNull: true },
      unit: { type: Sequelize.STRING(20), allowNull: true },
      manufacturer: { type: Sequelize.STRING(255), allowNull: true },
      requires_prescription: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_controlled: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('medications', ['generic_name'], { unique: true });
    await queryInterface.addIndex('medications', ['category']);
    await queryInterface.addIndex('medications', ['is_active']);

    // ─── Drug Batches ─────────────────────────────────────────
    await queryInterface.createTable('drug_batches', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      medication_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'medications', key: 'id' },
        onDelete: 'CASCADE',
      },
      institution_id: { type: Sequelize.UUID, allowNull: false },
      batch_number: { type: Sequelize.STRING(100), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      current_quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      unit_cost: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      selling_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      nhia_price: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      supplier_id: { type: Sequelize.UUID, allowNull: true },
      supplier_name: { type: Sequelize.STRING(255), allowNull: true },
      expiry_date: { type: Sequelize.DATEONLY, allowNull: false },
      manufacture_date: { type: Sequelize.DATEONLY, allowNull: true },
      received_date: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      location: { type: Sequelize.STRING(100), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'depleted', 'recalled', 'quarantined'),
        defaultValue: 'active',
      },
      reorder_level: { type: Sequelize.INTEGER, defaultValue: 10 },
      critical_level: { type: Sequelize.INTEGER, defaultValue: 3 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('drug_batches', ['medication_id', 'institution_id']);
    await queryInterface.addIndex('drug_batches', ['institution_id', 'status']);
    await queryInterface.addIndex('drug_batches', ['batch_number']);
    await queryInterface.addIndex('drug_batches', ['expiry_date']);

    // ─── Pharmacy Prescriptions ───────────────────────────────
    await queryInterface.createTable('pharmacy_prescriptions', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      patient_id: { type: Sequelize.UUID, allowNull: false },
      visit_id: { type: Sequelize.UUID, allowNull: true },
      doctor_id: { type: Sequelize.UUID, allowNull: true },
      department_id: { type: Sequelize.UUID, allowNull: true },
      institution_id: { type: Sequelize.UUID, allowNull: false },
      prescription_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      diagnosis: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_emergency: { type: Sequelize.BOOLEAN, defaultValue: false },
      priority: { type: Sequelize.ENUM('routine', 'urgent', 'stat'), defaultValue: 'routine' },
      status: {
        type: Sequelize.ENUM('pending', 'partially_dispensed', 'dispensed', 'canceled', 'expired'),
        defaultValue: 'pending',
      },
      dispensed_by: { type: Sequelize.UUID, allowNull: true },
      dispensed_at: { type: Sequelize.DATE, allowNull: true },
      canceled_by: { type: Sequelize.UUID, allowNull: true },
      canceled_at: { type: Sequelize.DATE, allowNull: true },
      cancel_reason: { type: Sequelize.TEXT, allowNull: true },
      prescribed_date: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      valid_until: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('pharmacy_prescriptions', ['institution_id']);
    await queryInterface.addIndex('pharmacy_prescriptions', ['patient_id']);
    await queryInterface.addIndex('pharmacy_prescriptions', ['visit_id']);
    await queryInterface.addIndex('pharmacy_prescriptions', ['prescription_number'], { unique: true });
    await queryInterface.addIndex('pharmacy_prescriptions', ['status']);
    await queryInterface.addIndex('pharmacy_prescriptions', ['institution_id', 'status']);

    // ─── Prescription Items ───────────────────────────────────
    await queryInterface.createTable('prescription_items', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      prescription_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'pharmacy_prescriptions', key: 'id' },
        onDelete: 'CASCADE',
      },
      medication_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'medications', key: 'id' },
      },
      dosage: { type: Sequelize.STRING(100), allowNull: false },
      frequency: { type: Sequelize.STRING(100), allowNull: false },
      duration: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      quantity_prescribed: { type: Sequelize.INTEGER, allowNull: true },
      quantity_dispensed: { type: Sequelize.INTEGER, defaultValue: 0 },
      route: { type: Sequelize.STRING(50), allowNull: true },
      instructions: { type: Sequelize.TEXT, allowNull: true },
      refill_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('pending', 'dispensed', 'partially_dispensed', 'canceled'),
        defaultValue: 'pending',
      },
      dispensed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('prescription_items', ['prescription_id']);
    await queryInterface.addIndex('prescription_items', ['medication_id']);

    // ─── Dispense Records ─────────────────────────────────────
    await queryInterface.createTable('dispense_records', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      prescription_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'pharmacy_prescriptions', key: 'id' },
      },
      prescription_item_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'prescription_items', key: 'id' },
      },
      drug_batch_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'drug_batches', key: 'id' },
      },
      medication_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'medications', key: 'id' },
      },
      institution_id: { type: Sequelize.UUID, allowNull: false },
      patient_id: { type: Sequelize.UUID, allowNull: false },
      quantity_dispensed: { type: Sequelize.INTEGER, allowNull: false },
      unit_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      total_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      nhia_price: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      dispensed_by: { type: Sequelize.UUID, allowNull: false },
      dispensed_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      pharmacist_notes: { type: Sequelize.TEXT, allowNull: true },
      batch_number_snapshot: { type: Sequelize.STRING(100), allowNull: true },
      billing_reference: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('dispense_records', ['prescription_id']);
    await queryInterface.addIndex('dispense_records', ['institution_id', 'dispensed_at']);
    await queryInterface.addIndex('dispense_records', ['patient_id']);

    // ─── Inventory Logs ───────────────────────────────────────
    await queryInterface.createTable('inventory_logs', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      drug_batch_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'drug_batches', key: 'id' },
      },
      medication_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'medications', key: 'id' },
      },
      institution_id: { type: Sequelize.UUID, allowNull: false },
      movement_type: {
        type: Sequelize.ENUM('received', 'dispensed', 'adjustment', 'expired', 'returned', 'transfer_in', 'transfer_out', 'recalled'),
        allowNull: false,
      },
      quantity_change: { type: Sequelize.INTEGER, allowNull: false },
      previous_quantity: { type: Sequelize.INTEGER, allowNull: false },
      new_quantity: { type: Sequelize.INTEGER, allowNull: false },
      reference_type: { type: Sequelize.STRING(50), allowNull: true },
      reference_id: { type: Sequelize.UUID, allowNull: true },
      performed_by: { type: Sequelize.UUID, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('inventory_logs', ['drug_batch_id']);
    await queryInterface.addIndex('inventory_logs', ['institution_id', 'movement_type']);

    // ─── Pharmacy Audits ──────────────────────────────────────
    await queryInterface.createTable('pharmacy_audits', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      institution_id: { type: Sequelize.UUID, allowNull: false },
      prescription_id: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'pharmacy_prescriptions', key: 'id' },
      },
      action: { type: Sequelize.STRING(100), allowNull: false },
      actor_id: { type: Sequelize.UUID, allowNull: false },
      actor_role: { type: Sequelize.STRING(50), allowNull: true },
      entity_type: { type: Sequelize.STRING(50), allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      old_values: { type: Sequelize.JSONB, allowNull: true },
      new_values: { type: Sequelize.JSONB, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('pharmacy_audits', ['institution_id']);
    await queryInterface.addIndex('pharmacy_audits', ['prescription_id']);
    await queryInterface.addIndex('pharmacy_audits', ['institution_id', 'created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pharmacy_audits');
    await queryInterface.dropTable('inventory_logs');
    await queryInterface.dropTable('dispense_records');
    await queryInterface.dropTable('prescription_items');
    await queryInterface.dropTable('pharmacy_prescriptions');
    await queryInterface.dropTable('drug_batches');
    await queryInterface.dropTable('medications');
  },
};

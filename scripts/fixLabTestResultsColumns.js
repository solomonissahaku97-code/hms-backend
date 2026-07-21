// One-off script to add missing columns to lab_test_results
// so the model and DB schema match. Idempotent via column existence checks.
const { sequelize, Sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

async function columnExists(table, column) {
  const res = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  return res.length > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`⏭  ${table}.${column} already exists, skipping`);
    return;
  }
  await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  console.log(`✅ Added ${table}.${column}`);
}

async function enumValueExists(enumName, value) {
  const res = await sequelize.query(
    `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = :enumName AND e.enumlabel = :value`,
    { replacements: { enumName, value }, type: QueryTypes.SELECT }
  );
  return res.length > 0;
}

async function addEnumValue(enumName, value) {
  if (await enumValueExists(enumName, value)) {
    console.log(`⏭  enum ${enumName} value '${value}' already exists, skipping`);
    return;
  }
  await sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`);
  console.log(`✅ Added enum ${enumName} value '${value}'`);
}

(async () => {
  try {
    // lab_test_fields.fieldType enum: ensure 'file' value exists
    await addEnumValue('enum_lab_test_fields_fieldType', 'file');
    await addColumn('lab_test_results', 'sample_number', 'VARCHAR(255)');
    await addColumn('lab_test_results', 'patient_id', 'UUID REFERENCES patients(id) ON DELETE CASCADE');
    await addColumn('lab_test_results', 'institution_id', 'UUID REFERENCES institutions(id) ON DELETE CASCADE');
    await addColumn('lab_test_results', 'attachments', 'JSON');
    await addColumn('lab_test_results', 'abnormal_flags', 'JSON DEFAULT \'[]\'::json');
    await addColumn('lab_test_results', 'specimen_type', 'VARCHAR(255)');
    await addColumn('lab_test_results', 'specimen_condition', 'VARCHAR(255)');
    await addColumn('lab_test_results', 'rejection_reason', 'TEXT');
    await addColumn('lab_test_results', 'rerun_of_id', 'UUID REFERENCES lab_test_results(id) ON DELETE CASCADE');
    await addColumn('lab_test_results', 'releasedBy', 'UUID REFERENCES staffs(id) ON DELETE SET NULL');
    await addColumn('lab_test_results', 'releasedAt', 'TIMESTAMP WITH TIME ZONE');
    await addColumn('lab_test_results', 'tat_started_at', 'TIMESTAMP WITH TIME ZONE');
    await addColumn('lab_test_results', 'tat_completed_at', 'TIMESTAMP WITH TIME ZONE');
    await addColumn('lab_test_results', 'tat_minutes', 'INTEGER');
    console.log('🎉 lab_test_results schema is up to date');

    // lab_test_templates missing columns
    await addColumn('lab_test_templates', 'name', 'VARCHAR(255) NOT NULL DEFAULT \'Unnamed Test\'');
    await addColumn('lab_test_templates', 'specimen_types', 'JSON DEFAULT \'[]\'::json');
    await addColumn('lab_test_templates', 'turnaround_time_hours', 'INTEGER DEFAULT 24');
    await addColumn('lab_test_templates', 'department_id', 'UUID REFERENCES departments(id) ON DELETE CASCADE');

    // Backfill template.name from linked lab_investigation test_description
    await sequelize.query(
      `UPDATE lab_test_templates t
       SET name = COALESCE(i.test_description, 'Unnamed Test')
       FROM lab_investigations i
       WHERE t.lab_tarrif_id = i.id AND (t.name IS NULL OR t.name = 'Unnamed Test')`
    );

    // lab_ranges missing columns
    await addColumn('lab_ranges', 'min_value', 'FLOAT');
    await addColumn('lab_ranges', 'max_value', 'FLOAT');
    await addColumn('lab_ranges', 'template_id', 'UUID REFERENCES lab_test_templates(id) ON DELETE CASCADE');

    // Separate doctor/request comment from technician comment
    await addColumn('lab_test_results', 'request_notes', 'TEXT');
    await addColumn('lab_test_results', 'technician_notes', 'TEXT');

    console.log('🎉 All lab table schemas are up to date');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();

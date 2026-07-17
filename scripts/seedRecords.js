/**
 * Seed script: creates a Record row for every patient that has at least one visit,
 * so the "Statement of Outpatients" report (which aggregates from the records table)
 * reflects real outpatient activity.
 *
 * Run with: node scripts/seedRecords.js
 *
 * - One Record per patient (most recent visit drives createdAt / department).
 * - is_insured is derived from the patient's latest active insurance row.
 * - folder_number is unique and auto-generated.
 */
require('dotenv').config();
const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
  }
);

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

(async () => {
  await sequelize.authenticate();
  console.log('[seed] Connected to database.');

  const patients = await sequelize.query(
    `SELECT DISTINCT p.id, p.institution_id
     FROM patients p
     INNER JOIN visits v ON v.patient_id = p.id`,
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(`[seed] Found ${patients.length} patients with visits.`);

  // Existing folder numbers to avoid unique collisions
  const existing = await sequelize.query(
    `SELECT folder_number FROM records`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const usedFolders = new Set(existing.map((r) => r.folder_number));

  let created = 0;

  for (const patient of patients) {
    const already = await sequelize.query(
      `SELECT id FROM records WHERE patient_id = :pid LIMIT 1`,
      { replacements: { pid: patient.id }, type: sequelize.QueryTypes.SELECT }
    );
    if (already.length > 0) {
      console.log(`[seed] Patient ${patient.id} already has a record, skipping.`);
      continue;
    }

    const visit = await sequelize.query(
      `SELECT institution_id, department_id, visit_date, created_at, status
       FROM visits WHERE patient_id = :pid
       ORDER BY visit_date DESC NULLS LAST LIMIT 1`,
      { replacements: { pid: patient.id }, type: sequelize.QueryTypes.SELECT }
    );
    if (visit.length === 0) continue;
    const v = visit[0];

    const insurance = await sequelize.query(
      `SELECT insured FROM insurances
       WHERE patient_id = :pid
       ORDER BY "createdAt" DESC LIMIT 1`,
      { replacements: { pid: patient.id }, type: sequelize.QueryTypes.SELECT }
    );
    const isInsured = insurance.length > 0 ? Boolean(insurance[0].insured) : false;

    let folderNumber;
    do {
      folderNumber = `F-${Math.floor(100000 + Math.random() * 900000)}`;
    } while (usedFolders.has(folderNumber));
    usedFolders.add(folderNumber);

    const now = new Date();
    const visitDate = v.visit_date ? new Date(v.visit_date) : new Date(v.created_at);

    await sequelize.query(
      `INSERT INTO records
        (id, patient_id, institution_id, department_id, folder_number, serial_number,
         visit_type, status, condition_status, is_insured, "createdAt", "updatedAt")
       VALUES
        (:id, :pid, :iid, :did, :fn, :sn, 'outpatient', 'active', 'stable', :ins, :created, :updated)`,
      {
        replacements: {
          id: uuid(),
          pid: patient.id,
          iid: v.institution_id,
          did: v.department_id,
          fn: folderNumber,
          sn: `${now.getFullYear()}-${String(created++ + 1).padStart(4, '0')}`,
          ins: isInsured,
          created: visitDate,
          updated: now,
        },
        type: sequelize.QueryTypes.INSERT,
      }
    );

    console.log(
      `[seed] Created record for patient ${patient.id} (insured: ${isInsured})`
    );
  }

  console.log('[seed] Done.');
  await sequelize.close();
})().catch(async (err) => {
  console.error('[seed] Failed:', err.message);
  await sequelize.close();
  process.exit(1);
});

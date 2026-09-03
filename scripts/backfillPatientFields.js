const { sequelize } = require('../models');

(async () => {
  const [result] = await sequelize.query(`
    UPDATE patients
    SET
      address = COALESCE(address, metadata->>'address'),
      city = COALESCE(city, metadata->>'city'),
      country = COALESCE(country, metadata->>'country'),
      email = COALESCE(email, metadata->>'email'),
      religion = COALESCE(religion, metadata->>'religion'),
      nhis_number = COALESCE(nhis_number, metadata->>'nhis_number'),
      nin_number = COALESCE(nin_number, metadata->>'nin_number'),
      ghana_card_number = COALESCE(ghana_card_number, metadata->>'ghana_card_number')
    WHERE metadata IS NOT NULL
  `);
  console.log('Backfilled', result, 'rows');

  // Also update Issahaku Solomon specifically
  const [r2] = await sequelize.query(`
    UPDATE patients
    SET email = COALESCE(email, 'patient_HMS-2026-0008@tonitel.local')
    WHERE folder_number = 'HMS-2026-0008'
  `);
  console.log('Updated Issahaku Solomon:', r2);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

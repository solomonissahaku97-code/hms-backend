'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add columns one by one to avoid errors if some already exist
    const columns = [
      { name: 'address', type: Sequelize.TEXT },
      { name: 'city', type: Sequelize.STRING(100) },
      { name: 'country', type: Sequelize.STRING(100) },
      { name: 'email', type: Sequelize.STRING(255) },
      { name: 'religion', type: Sequelize.STRING(100) },
      { name: 'nhis_number', type: Sequelize.STRING(50) },
      { name: 'nin_number', type: Sequelize.STRING(50) },
      { name: 'ghana_card_number', type: Sequelize.STRING(50) },
    ];

    for (const col of columns) {
      try {
        await queryInterface.addColumn('patients', col.name, {
          type: col.type,
          allowNull: true,
        });
        console.log(`  ✓ Added column: ${col.name}`);
      } catch (err) {
        if (err.message.includes('already exists') || err.code === '42701') {
          console.log(`  ⊘ Column ${col.name} already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    // Backfill from metadata where possible
    try {
      await queryInterface.sequelize.query(`
        UPDATE patients
        SET
          address = COALESCE(address, metadata->'address'),
          city = COALESCE(city, metadata->'city'),
          country = COALESCE(country, metadata->'country'),
          email = COALESCE(email, metadata->'email'),
          religion = COALESCE(religion, metadata->'religion'),
          nhis_number = COALESCE(nhis_number, metadata->'nhis_number'),
          nin_number = COALESCE(nin_number, metadata->'nin_number'),
          ghana_card_number = COALESCE(ghana_card_number, metadata->'ghana_card_number')
        WHERE metadata IS NOT NULL
      `);
      console.log('  ✓ Backfilled from metadata');
    } catch (err) {
      console.log('  ⊘ Backfill skipped:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = [
      'address', 'city', 'country', 'email',
      'religion', 'nhis_number', 'nin_number', 'ghana_card_number',
    ];
    for (const col of columns) {
      try {
        await queryInterface.removeColumn('patients', col);
      } catch (err) {
        // ignore if already removed
      }
    }
  },
};

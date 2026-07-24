const { sequelize } = require('../config/database');

async function main() {
  const inst = await sequelize.query('SELECT id FROM institutions LIMIT 1');
  console.log('Institutions:', JSON.stringify(inst, null, 2));

  const depts = await sequelize.query('SELECT id, name, institution_id FROM departments LIMIT 5');
  console.log('Departments:', JSON.stringify(depts, null, 2));

  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

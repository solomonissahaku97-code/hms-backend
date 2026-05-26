const { AccessControl } = require('../models'); // Adjust the path as necessary

const defaultAccessControls = [
  { name: 'Access to Partograph', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Treatment Sheet', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Request for Items', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Vital Signs', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Patient Diagnosis', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Lab Request', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Billings', createdAt: new Date(), updatedAt: new Date() },
  { name: 'X-ray Request', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Consultation', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Permission 10', createdAt: new Date(), updatedAt: new Date() },
];

const createAccessControls = async () => {
  try {
    const existingAccessControls = await AccessControl.findAll();
    if (existingAccessControls.length === 0) {
      await AccessControl.bulkCreate(defaultAccessControls);
      console.log('Default AccessControls created');
    } else {
      console.log('AccessControls already exist');
    }
  } catch (error) {
    console.error('Error creating AccessControls:', error);
  }
};

module.exports = createAccessControls;

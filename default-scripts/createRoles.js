const { Role } = require('../models'); // Adjust the path as necessary

const defaultRoles = [
  { name: 'Doctor', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Nurse', createdAt: new Date(), updatedAt: new Date() },
  { name: 'MidWife', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Lab Technician', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Pharmacist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Radiologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Surgeon', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Anesthesiologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Physician Assistant', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Occupational Therapist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Physical Therapist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Respiratory Therapist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Nutritionist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Dietitian', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Medical Receptionist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Medical Secretary', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Medical Records Clerk', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Biomedical Engineer', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Cardiologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Dermatologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Orthopedic Surgeon', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Neurosurgeon', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Pediatrician', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Psychiatrist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Oncologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Gynecologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Urologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Ophthalmologist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Dentist', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Chiropractor', createdAt: new Date(), updatedAt: new Date() },  
  { name: 'Claims Officer', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Pharmacy Technician', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Health Information Manager', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Clinical Research Coordinator', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Clinical Research Associate', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Health Educator', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Public Health Nurse', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Infection Control Nurse', createdAt: new Date(), updatedAt: new Date() },
  { name: 'Quality Improvement Coordinator', createdAt: new Date(), updatedAt: new Date() }
  

];

const createRoles = async () => {
  try {
    const existingRoles = await Role.findAll();
    if (existingRoles.length === 0) {
      await Role.bulkCreate(defaultRoles);
      console.log('Default Roles created');
    } else {
      console.log('Roles already exist');
    }
  } catch (error) {
    console.error('Error creating Roles:', error);
  }
};

module.exports = createRoles;

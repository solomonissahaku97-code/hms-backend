const sequelize = require('../config/database');
const NHIATariffs = require('../models/nhia_tariffs');

const tariffs = [
    { code: 'A01', description: 'General Consultation', category: 'Procedure', tariff: 100, level: 'Primary' },
    { code: 'MED123', description: 'Paracetamol 500mg', category: 'Medicine', tariff: 5, level: 'Primary' },
    { code: 'ICD10-001', description: 'Hypertension', category: 'ICD', tariff: 0, level: 'Primary' },
    { code: 'INVE-01', description: 'Blood Test', category: 'Investigation', tariff: 50, level: 'Secondary' }
];
 
const insertTariffs = async () => {
    try {
        await sequelize.sync(); // Ensure table exists
        await NHIATariffs.bulkCreate(tariffs, { ignoreDuplicates: true });
        console.log('NHIA Tariffs inserted successfully!');
    } catch (error) {
        console.error('Error inserting NHIA Tariffs:', error);
    } finally {
        await sequelize.close();
    }
};

insertTariffs();

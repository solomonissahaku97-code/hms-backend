const Diagnosis = require("../models/diagnosis");

const diagnoses = [
    { diagnosis_code: 'A01', diagnosis_name: 'Tuberculosis' },
    { diagnosis_code: 'B01', diagnosis_name: 'Varicella (chickenpox)' },
    { diagnosis_code: 'C01', diagnosis_name: 'Malignant neoplasm of lip' },
    { diagnosis_code: 'D01', diagnosis_name: 'Benign neoplasm of lip' },
    { diagnosis_code: 'E01', diagnosis_name: 'Thyroid disorders' },
    { diagnosis_code: 'F01', diagnosis_name: 'Vascular dementia' },
    { diagnosis_code: 'G01', diagnosis_name: 'Meningitis due to bacteria' },
    { diagnosis_code: 'H01', diagnosis_name: 'Conjunctivitis' },
    { diagnosis_code: 'I01', diagnosis_name: 'Rheumatic fever' },
    { diagnosis_code: 'J01', diagnosis_name: 'Acute sinusitis' },
    { diagnosis_code: 'T0F', diagnosis_name: 'Typhoid Fever' },
    { diagnosis_code: 'H05', diagnosis_name: 'Human immune Virus' },
];

async function addInitialDiagnoses() {
    try {
        for (const diagnosis of diagnoses) {
            await Diagnosis.findOrCreate({
                where: { diagnosis_code: diagnosis.diagnosis_code },
                defaults: diagnosis,
            });
        }
        console.log('Diagnoses seeded successfully.');
    } catch (error) {
        console.error('Error seeding diagnoses:', error.message, error.stack);
    }
}

module.exports = addInitialDiagnoses;

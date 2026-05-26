const NHIA_ICD = require("../models/nhia_icd");
const sequelize = require("../config/database");

const nhiaICDCodes = [
    { code: "A00", description: "Cholera" },
    { code: "B20", description: "HIV/AIDS" },
    { code: "E11", description: "Type 2 Diabetes Mellitus" },
    { code: "I10", description: "Essential Hypertension" },
    { code: "J18", description: "Pneumonia, unspecified organism" },
];
 
async function insertNHIA_ICD() {
    try {
        await sequelize.sync();

        // Insert NHIA ICD-10 codes
        for (let icd of nhiaICDCodes) {
            await NHIA_ICD.findOrCreate({
                where: { code: icd.code },
                defaults: icd
            });
        }

        console.log("✅ NHIA ICD-10 codes inserted successfully!");
    } catch (error) {
        console.error("Error inserting NHIA ICD codes:", error);
    } finally {
        process.exit();
    }
}

insertNHIA_ICD();

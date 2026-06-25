const { Op, fn, col, literal } = require('sequelize');
const Record = require('../../models/record');
const Patient = require('../../models/patient');


const getPatientReport = async (req, res) => {
    const { institution_id } = req.query;
    console.log('it is working')

    try {
        console.log('[REPORT] Starting report generation for institution:', institution_id);

        // Define age groups with proper property access
        const ageGroups = [
            { label: '0-28 days', minValue: 0, maxValue: 28/365.25 },
            { label: '1-11 months', minValue: 28/365.25, maxValue: 1 },
            { label: '1-4 Years', minValue: 1, maxValue: 4 },
            { label: '5-9 Years', minValue: 5, maxValue: 9 },
            { label: '10-14 Years', minValue: 10, maxValue: 14 },
            { label: '15-17 Years', minValue: 15, maxValue: 17 },
            { label: '18-19 Years', minValue: 18, maxValue: 19 },
            { label: '20-34 Years', minValue: 20, maxValue: 34.00274 },
            { label: '35-49 Years', minValue: 35, maxValue: 49.00274 },
            { label: '50-59 Years', minValue: 50, maxValue: 59.00274 },
            { label: '60-69 Years', minValue: 60, maxValue: 69.00274 },
            { label: '70 Yrs & Above', minValue: 70, maxValue: 150 }
        ];

        // Get all records with patient data
        const records = await Record.findAll({
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    required: true,
                    where: {
                        date_of_birth: {
                            [Op.ne]: null
                        }
                    }
                }
            ],
            where: { institution_id },
            raw: true
        });

        console.log('[REPORT] Found records:', records.length);
        if (records.length === 0) {
            console.log('[REPORT] No records found for institution:', institution_id);
        }

        // Get current date
        const currentDate = new Date();
        console.log('[REPORT] Current date:', currentDate);

        // Organize data into categories
        let reportData = ageGroups.map(group => ({
            group: group.label,
            insured: { new: { male: 0, female: 0 }, old: { male: 0, female: 0 } },
            nonInsured: { new: { male: 0, female: 0 }, old: { male: 0, female: 0 } },
            total: { male: 0, female: 0 },
            minValue: group.minValue,  // For debugging
            maxValue: group.maxValue   // For debugging
        }));

        // Process records
        records.forEach((record, index) => {
            try {
                console.log(`\n[REPORT] Processing record ${index + 1}/${records.length}`);
                console.log('[REPORT] Record ID:', record.id);
                console.log('[REPORT] Patient ID:', record.patient_id);

                const dobString = record['patient.date_of_birth'];
                const gender = record['patient.gender'];
                const isInsured = record.is_insured;
                const createdAt = new Date(record.createdAt);

                console.log('[REPORT] DOB:', dobString);
                console.log('[REPORT] Gender:', gender);
                console.log('[REPORT] Is Insured:', isInsured);
                console.log('[REPORT] Created At:', createdAt);

                if (!dobString) {
                    console.log('[REPORT] Skipping - no date of birth');
                    return;
                }

                // Parse the ISO date string
                const dob = new Date(dobString);
                if (isNaN(dob.getTime())) {
                    console.log('[REPORT] Skipping - invalid date format');
                    return;
                }

                // Calculate age in years
                let age = currentDate.getFullYear() - dob.getFullYear();
                const monthDiff = currentDate.getMonth() - dob.getMonth();
                
                // Adjust age if birthday hasn't occurred yet this year
                if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < dob.getDate())) {
                    age--;
                }

                // For infants < 1 year, calculate precise age in decimal years
                if (age === 0) {
                    const ageInDays = (currentDate - dob) / (1000 * 60 * 60 * 24);
                    const ageInYears = ageInDays / 365.25;
                    age = ageInYears;
                }

                console.log('[REPORT] Calculated age:', age, 'years');

                const isNewPatient = createdAt.getFullYear() === currentDate.getFullYear();
                const genderKey = gender?.toLowerCase() === 'male' ? 'male' : 'female';

                console.log('[REPORT] Is new patient:', isNewPatient);
                console.log('[REPORT] Gender key:', genderKey);

                // Find age group
                const ageGroup = reportData.find(group => {
                    console.log(`[REPORT] Checking group ${group.group} (${group.minValue} to ${group.maxValue})`);
                    return age >= group.minValue && age < group.maxValue;
                });

                if (!ageGroup) {
                    console.log('[REPORT] No age group found for age:', age);
                    return;
                }

                console.log('[REPORT] Matched age group:', ageGroup.group);

                // Categorize data
                const category = isInsured ? ageGroup.insured : ageGroup.nonInsured;
                const newOldKey = isNewPatient ? 'new' : 'old';
                category[newOldKey][genderKey]++;
                ageGroup.total[genderKey]++;

                console.log('[REPORT] Updated counts:', {
                    category: isInsured ? 'insured' : 'nonInsured',
                    newOldKey,
                    genderKey,
                    count: category[newOldKey][genderKey]
                });

            } catch (error) {
                console.error('[REPORT] Error processing record:', error);
            }
        });

        // Remove debug values before returning
        reportData.forEach(group => {
            delete group.minValue;
            delete group.maxValue;
        });

        console.log('\n[REPORT] Final report data:', JSON.stringify(reportData, null, 2));
        return res.json({ success: true, data: reportData });

    } catch (error) {
        console.error('[REPORT] Error in getPatientReport:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error',
            error: error.message 
        });
    }
};
module.exports = { getPatientReport };

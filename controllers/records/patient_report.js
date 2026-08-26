const { Op } = require('sequelize');
const Record = require('../../models/record');
const Patient = require('../../models/patient');

// Age groups for the outpatient statement (keyed exactly by `group` label).
const AGE_GROUPS = [
  { label: '0-28 days', min: 0, max: 28 / 365.25 },
  { label: '1-11 months', min: 28 / 365.25, max: 1 },
  { label: '1-4 Years', min: 1, max: 4 },
  { label: '5-9 Years', min: 5, max: 9 },
  { label: '10-14 Years', min: 10, max: 14 },
  { label: '15-17 Years', min: 15, max: 17 },
  { label: '18-19 Years', min: 18, max: 19 },
  { label: '20-34 Years', min: 20, max: 34.00274 },
  { label: '35-49 Years', min: 35, max: 49.00274 },
  { label: '50-59 Years', min: 50, max: 59.00274 },
  { label: '60-69 Years', min: 60, max: 69.00274 },
  { label: '70 Yrs & Above', min: 70, max: 150 },
];

const emptyBreakdown = () => ({
  new: { male: 0, female: 0 },
  old: { male: 0, female: 0 },
});

const emptyGroup = (label) => ({
  group: label,
  insured: emptyBreakdown(),
  nonInsured: emptyBreakdown(),
  total: { male: 0, female: 0 },
});

const calculateAgeInYears = (dob, now) => {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }

  if (age === 0) {
    const ageInDays = (now - dob) / (1000 * 60 * 60 * 24);
    return ageInDays / 365.25;
  }

  return age;
};

const getPatientReport = async (req, res) => {
  const { institution_id } = req.query;

  if (!institution_id) {
    return res.status(400).json({
      success: false,
      message: 'institution_id is required',
    });
  }

  try {
    const records = await Record.findAll({
      include: [
        {
          model: Patient,
          as: 'patient',
          required: true,
          where: { date_of_birth: { [Op.ne]: null } },
        },
      ],
      where: { institution_id },
      raw: true,
    });

    const now = new Date();
    const reportData = AGE_GROUPS.map((g) => ({ ...emptyGroup(g.label), minValue: g.min, maxValue: g.max }));

    records.forEach((record) => {
      const dobString = record['patient.date_of_birth'];
      if (!dobString) return;

      const dob = new Date(dobString);
      if (isNaN(dob.getTime())) return;

      const age = calculateAgeInYears(dob, now);
      const ageGroup = reportData.find((g) => age >= g.minValue && age < g.maxValue);
      if (!ageGroup) return;

      const genderKey = record['patient.gender'] === 'M' ? 'male' : 'female';
      const isInsured = Boolean(record.is_insured);
      const isNewPatient = new Date(record.createdAt).getFullYear() === now.getFullYear();

      const category = isInsured ? ageGroup.insured : ageGroup.nonInsured;
      const periodKey = isNewPatient ? 'new' : 'old';

      category[periodKey][genderKey]++;
      ageGroup.total[genderKey]++;
    });

    const cleanData = reportData.map(({ group, insured, nonInsured, total }) => ({
      group,
      insured,
      nonInsured,
      total,
    }));

    return res.json({ success: true, data: cleanData });
  } catch (error) {
    console.error('[getPatientReport] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

module.exports = { getPatientReport };

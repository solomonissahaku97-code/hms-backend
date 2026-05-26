// controllers/informationManager/labAnalysisController.js

const { Op } = require('sequelize');
const LabTestResult = require('../../models/lab/LabTestResult');
const LabTestTemplate = require('../../models/lab/LabTestTemplate');
const LabRanges = require('../../models/lab/LabRanges');
const Department = require('../../models/department');
const Staff = require('../../models/staff');

exports.getLabAnalytics = async (req, res) => {
  try {
    // --- 1️⃣ Lab Test Summary by Status ---
    const statusSummary = await LabTestResult.findAll({
      attributes: [
        'status',
        [LabTestResult.sequelize.fn('COUNT', LabTestResult.sequelize.col('status')), 'count']
      ],
      group: ['status']
    });

    // --- 2️⃣ Top Lab Tests Performed ---
    const topTests = await LabTestResult.findAll({
      attributes: [
        'templateId',
        [LabTestResult.sequelize.fn('COUNT', LabTestResult.sequelize.col('templateId')), 'total']
      ],
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
          attributes: ['id', 'description']
        }
      ],
      group: ['templateId', 'template.id', 'template.description'],
      order: [[LabTestResult.sequelize.literal('total'), 'DESC']],
      limit: 10
    });

    // --- 3️⃣ Departmental Performance ---
    const departmentPerformance = await LabTestResult.findAll({
      attributes: [
        'department_id',
        [LabTestResult.sequelize.fn('COUNT', LabTestResult.sequelize.col('department_id')), 'total']
      ],
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name'] }
      ],
      group: ['department_id', 'department.id', 'department.name'],
      order: [[LabTestResult.sequelize.literal('total'), 'DESC']]
    });

    // --- 4️⃣ Staff Performance ---
    const staffPerformance = await LabTestResult.findAll({
      attributes: [
        'verifiedBy',
        [LabTestResult.sequelize.fn('COUNT', LabTestResult.sequelize.col('verifiedBy')), 'total']
      ],
      include: [
        { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName', ] }
      ],
      where: { verifiedBy: { [Op.ne]: null } },
      group: ['verifiedBy', 'verifier.id', 'verifier.firstName', 'verifier.lastName', ],
      order: [[LabTestResult.sequelize.literal('total'), 'DESC']],
      limit: 10
    });

    // --- 5️⃣ Abnormal Result Detection ---
    const labResults = await LabTestResult.findAll({
      include: [
        { model: LabTestTemplate, as: 'template', attributes: ['description'] }
      ]
    });

    const ranges = await LabRanges.findAll();
    const abnormalSummaries = [];

    for (const result of labResults) {
      if (!result.values) continue;

      const testValues = result.values; // JSON of test_name:value
      Object.entries(testValues).forEach(([testName, value]) => {
        const matchingRange = ranges.find(r => r.test_name.toLowerCase() === testName.toLowerCase());
        if (!matchingRange) return;

        const rangeStr = matchingRange.reference_range; // e.g. "3.5 - 5.5"
        const [min, max] = rangeStr.split('-').map(v => parseFloat(v.trim()));

        if (!isNaN(min) && !isNaN(max) && parseFloat(value) !== undefined) {
          const val = parseFloat(value);
          const isAbnormal = val < min || val > max;

          abnormalSummaries.push({
            test_name: testName,
            value: val,
            reference_range: rangeStr,
            unit: matchingRange.unit || '',
            status: isAbnormal ? 'abnormal' : 'normal'
          });
        }
      });
    }

    // --- 6️⃣ Aggregate Abnormal Summary ---
    const abnormalSummary = abnormalSummaries.reduce((acc, curr) => {
      const existing = acc.find(a => a.test_name === curr.test_name);
      if (existing) {
        existing.total += 1;
        if (curr.status === 'abnormal') existing.abnormal += 1;
      } else {
        acc.push({
          test_name: curr.test_name,
          total: 1,
          abnormal: curr.status === 'abnormal' ? 1 : 0
        });
      }
      return acc;
    }, []);

    // Add percentage
    abnormalSummary.forEach(item => {
      item.abnormal_rate = ((item.abnormal / item.total) * 100).toFixed(2);
    });

    // ✅ Send Combined Response
    res.json({
      statusSummary,
      topTests,
      departmentPerformance,
      staffPerformance,
      abnormalSummary
    });

  } catch (error) {
    console.log('Error generating lab analytics:', error);
    res.status(500).json({ message: 'Error generating lab analytics' });
  }
};

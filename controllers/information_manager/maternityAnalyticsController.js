// controllers/maternityAnalyticsController.js
// const ANC = require('../models/ANC');
// const DeliveryRegister = require('../models/maternity/DeliveryRegister');
// const MaternityAudit = require('../models/maternityAudit');
// const PNC = require('../models/maternity/PNC');
// const Ultrasound = require('../models/maternity/Ultrasound');
const { Sequelize, Op } = require('sequelize');
const sequelize = require('../../config/database');
const ANC = require('../../models/maternity/ANC');
const Ultrasound = require('../../models/maternity/Ultrasound');
const MaternityAudit = require('../../models/maternity/MaternityAudit');
const DeliveryRegister = require('../../models/maternity/DeliveryRegister');
const PNC = require('../../models/maternity/PNC');

// @desc    Get comprehensive maternity analytics
// @route   GET /api/maternity-analytics
// @access  Private/InformationManager
exports.getMaternityAnalytics = async (req, res, next) => {
  try {
    // Execute all analytics queries in parallel
    const [
      deliveryOutcomes,
      deliveryModes,
      birthWeights,
      complications,
      ancStats,
      hivStats,
      pncStats,
      ultrasoundStats,
      maternalDemographics,
      babyOutcomes
    ] = await Promise.all([
      // 1. Delivery Outcomes
      DeliveryRegister.findAll({
        attributes: [
          'outcome',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['outcome']
      }),

      // 2. Delivery Modes
      DeliveryRegister.findAll({
        attributes: [
          'mode_of_delivery',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['mode_of_delivery']
      }),

      // 3. Birth Weight Statistics
      DeliveryRegister.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('birth_weight')), 'avg_weight'],
          [sequelize.fn('MIN', sequelize.col('birth_weight')), 'min_weight'],
          [sequelize.fn('MAX', sequelize.col('birth_weight')), 'max_weight'],
          [sequelize.fn('COUNT', sequelize.col('birth_weight')), 'total_weighed']
        ],
        where: {
          birth_weight: {
            [Op.ne]: null
          }
        }
      }),

      // 4. Complication Rates
      DeliveryRegister.findAll({
        attributes: [
          'complications',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          complications: {
            [Op.ne]: null
          }
        },
        group: ['complications']
      }),

      // 5. ANC Statistics
      ANC.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('mother_age')), 'avg_mother_age'],
          [sequelize.fn('AVG', sequelize.col('parity')), 'avg_parity'],
          [sequelize.fn('AVG', sequelize.col('gestational_age_weeks')), 'avg_gestational_age'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_anc_visits']
        ]
      }),

      // 6. HIV Status Statistics
      ANC.findAll({
        attributes: [
          'hiv_status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          hiv_status: {
            [Op.ne]: null
          }
        },
        group: ['hiv_status']
      }),

      // 7. PNC Statistics
      PNC.findAll({
        attributes: [
          'mother_condition',
          'baby_condition',
          'breastfeeding_status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['mother_condition', 'baby_condition', 'breastfeeding_status']
      }),

      // 8. Ultrasound Utilization
      Ultrasound.findAll({
        attributes: [
          'scan_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['scan_type']
      }),

      // 9. Maternal Age Distribution
      ANC.findAll({
        attributes: [
          [sequelize.literal(`CASE 
            WHEN mother_age < 20 THEN 'Teen (<20)'
            WHEN mother_age BETWEEN 20 AND 35 THEN 'Adult (20-35)'
            WHEN mother_age > 35 THEN 'Advanced Maternal Age (>35)'
            ELSE 'Unknown'
          END`), 'age_group'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: [sequelize.literal('age_group')]
      }),

      // 10. Baby Outcomes from Maternity Audit
      MaternityAudit.findAll({
        attributes: [
          'baby_outcome',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['baby_outcome']
      })
    ]);

    // Calculate specific rates and percentages
    const totalDeliveries = deliveryOutcomes.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
    const totalANC = ancStats[0]?.dataValues?.total_anc_visits || 0;
    const totalPNC = pncStats.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);

    // Caesarean Section Rate
    const cSectionCount = deliveryModes.find(item => item.dataValues.mode_of_delivery === 'Caesarean')?.dataValues.count || 0;
    const cSectionRate = totalDeliveries > 0 ? (cSectionCount / totalDeliveries) * 100 : 0;

    // Stillbirth Rate
    const stillbirthCount = deliveryOutcomes.find(item => item.dataValues.outcome === 'Stillbirth')?.dataValues.count || 0;
    const stillbirthRate = totalDeliveries > 0 ? (stillbirthCount / totalDeliveries) * 1000 : 0;

    // Low Birth Weight Rate
    const totalWeighed = birthWeights[0]?.dataValues?.total_weighed || 0;
    const lowWeightDeliveries = await DeliveryRegister.count({
      where: {
        birth_weight: {
          [Op.lt]: 2.5,
          [Op.ne]: null
        }
      }
    });
    const lowBirthWeightRate = totalWeighed > 0 ? (lowWeightDeliveries / totalWeighed) * 100 : 0;

    // HIV Prevalence
    const totalHIVTested = hivStats.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
    const hivPositiveCount = hivStats.find(item => item.dataValues.hiv_status === 'Positive')?.dataValues.count || 0;
    const hivPrevalence = totalHIVTested > 0 ? (hivPositiveCount / totalHIVTested) * 100 : 0;

    // Anemia Prevalence (Hemoglobin < 11.0 g/dL)
    const anemicMothers = await ANC.count({
      where: {
        hemoglobin_level: {
          [Op.lt]: 11.0,
          [Op.ne]: null
        }
      }
    });
    const totalWithHemoglobin = await ANC.count({
      where: {
        hemoglobin_level: {
          [Op.ne]: null
        }
      }
    });
    const anemiaRate = totalWithHemoglobin > 0 ? (anemicMothers / totalWithHemoglobin) * 100 : 0;

    // PNC Coverage Rate
    const pncCoverageRate = totalDeliveries > 0 ? (totalPNC / totalDeliveries) * 100 : 0;

    // Ultrasound Utilization Rate
    const totalUltrasounds = ultrasoundStats.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
    const ultrasoundRate = totalANC > 0 ? (totalUltrasounds / totalANC) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalDeliveries,
          totalANCVisits: totalANC,
          totalPNCVisits: totalPNC,
          totalUltrasounds
        },
        deliveryOutcomes: deliveryOutcomes.map(item => ({
          outcome: item.dataValues.outcome,
          count: item.dataValues.count
        })),
        deliveryModes: deliveryModes.map(item => ({
          mode: item.dataValues.mode_of_delivery,
          count: item.dataValues.count,
          percentage: totalDeliveries > 0 ? (item.dataValues.count / totalDeliveries) * 100 : 0
        })),
        birthWeightStats: {
          average: birthWeights[0]?.dataValues?.avg_weight || 0,
          minimum: birthWeights[0]?.dataValues?.min_weight || 0,
          maximum: birthWeights[0]?.dataValues?.max_weight || 0,
          lowBirthWeightRate,
          totalWeighed
        },
        complicationRates: complications.map(item => ({
          complication: item.dataValues.complications,
          count: item.dataValues.count,
          rate: totalDeliveries > 0 ? (item.dataValues.count / totalDeliveries) * 100 : 0
        })),
        ancStatistics: {
          averageMotherAge: ancStats[0]?.dataValues?.avg_mother_age || 0,
          averageParity: ancStats[0]?.dataValues?.avg_parity || 0,
          averageGestationalAge: ancStats[0]?.dataValues?.avg_gestational_age || 0,
          totalVisits: totalANC
        },
        hivStatistics: {
          prevalence: hivPrevalence,
          positiveCount: hivPositiveCount,
          testedCount: totalHIVTested,
          distribution: hivStats.map(item => ({
            status: item.dataValues.hiv_status,
            count: item.dataValues.count
          }))
        },
        pncStatistics: {
          coverageRate: pncCoverageRate,
          motherConditions: pncStats.filter(item => item.dataValues.mother_condition).map(item => ({
            condition: item.dataValues.mother_condition,
            count: item.dataValues.count
          })),
          babyConditions: pncStats.filter(item => item.dataValues.baby_condition).map(item => ({
            condition: item.dataValues.baby_condition,
            count: item.dataValues.count
          })),
          breastfeeding: pncStats.filter(item => item.dataValues.breastfeeding_status).map(item => ({
            status: item.dataValues.breastfeeding_status,
            count: item.dataValues.count
          }))
        },
        ultrasoundStatistics: {
          utilizationRate: ultrasoundRate,
          byType: ultrasoundStats.map(item => ({
            type: item.dataValues.scan_type,
            count: item.dataValues.count
          }))
        },
        maternalDemographics: {
          ageDistribution: maternalDemographics.map(item => ({
            group: item.dataValues.age_group,
            count: item.dataValues.count
          })),
          anemiaRate
        },
        keyRates: {
          caesareanRate: cSectionRate,
          stillbirthRate,
          neonatalDeathRate: deliveryOutcomes.find(item => item.dataValues.outcome === 'Neonatal Death')?.dataValues.count || 0,
          liveBirthRate: deliveryOutcomes.find(item => item.dataValues.outcome === 'Alive')?.dataValues.count || 0
        }
      }
    });

  } catch (error) {
    console.error('Maternity Analytics Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching maternity analytics data',
      error: error.message
    });
  }
};
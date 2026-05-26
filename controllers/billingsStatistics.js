const { sequelize } = require("../models");
const Department = require("../models/department");
const Institution = require("../models/institution");
const Patient = require("../models/patient");
const Service = require("../models/service");
const ServiceBill = require("../models/serviceBill");
const { Op } = require('sequelize');



exports.getBillingStatistics = async (req, res) => {
    const { institution_id, time_range = 'monthly' } = req.query;
    
    try {
        // Validate institution exists
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        // Base query for all statistics
        const bills = await ServiceBill.findAll({
            where: { institution_id },
            include: [
                { model: Department, as: 'department', attributes: ['id', 'name'] },
                { model: Patient, as: 'patient', attributes: ['id'] }
            ],
            raw: true,
            nest: true
        });


        if (!bills || bills.length === 0) {
            return res.status(200).json({ 
                message: 'No billing data found',
                statistics: getEmptyStatsTemplate() 
            });
        }

        // Current date calculations
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();
        const currentWeek = getWeekNumber(now);

        // Process statistics
        const statistics = {
            overview: {
                total_bills: bills.length,
                total_revenue: bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0),

                paid_bills: bills.filter(b => b.has_paid).length,
                unpaid_bills: bills.filter(b => !b.has_paid).length,
                payment_success_rate: (bills.filter(b => b.has_paid).length / bills.length) * 100 || 0
            },
            time_based: await getTimeBasedStats(bills, time_range, institution_id),
            department_stats: getDepartmentStats(bills),
            service_stats: getServiceStats(bills),
            trends: {
                daily: await getDailyTrends(institution_id),
                monthly: await getMonthlyTrends(institution_id),
                weekly: await getWeeklyTrends(institution_id)
            },
            current_period: {
                day: await getPeriodStats(institution_id, 'day', currentDay, currentMonth, currentYear),
                week: await getPeriodStats(institution_id, 'week', currentWeek, currentMonth, currentYear),
                month: await getPeriodStats(institution_id, 'month', currentMonth, null, currentYear),
                year: await getPeriodStats(institution_id, 'year', currentYear)
            },
            patient_stats: {
                average_bills_per_patient: bills.length / new Set(bills.map(b => b.patient_id)).size,
                top_patients_by_bills: getTopPatientsByBills(bills),
                top_patients_by_spending: getTopPatientsBySpending(bills)
            }
        };

        return res.status(200).json(statistics);

    } catch (error) {
        console.error('Error generating billing statistics:', error);
        return res.status(500).json({ error: 'Failed to generate statistics', details: error.message });
    }
};

// Helper functions

async function getTimeBasedStats(bills, time_range, institution_id) {
    const stats = {
        daily: [],
        weekly: [],
        monthly: [],
        yearly: []
    };

    // Get daily stats (last 30 days)
    const dailyDates = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dailyDates.push(date.toISOString().split('T')[0]);
    }

    stats.daily = await Promise.all(dailyDates.map(async date => {
        const dayBills = await ServiceBill.findAll({
            where: { 
                institution_id,
                created_at: {
                    [Op.between]: [
                        new Date(`${date}T00:00:00.000Z`),
                        new Date(`${date}T23:59:59.999Z`)
                    ]
                }
            },
            include: [{ model: Service, as: 'service' }]
        });

        return {
            date,
            count: dayBills.length,
            revenue: dayBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0),

            paid: dayBills.filter(b => b.has_paid).length
        };
    }));

    // Get weekly stats (last 12 weeks)
    const weeklyStats = [];
    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekNumber = getWeekNumber(weekStart);
        const year = weekStart.getFullYear();

        const weekBills = bills.filter(bill => {
            const billDate = new Date(bill.created_at);
            return getWeekNumber(billDate) === weekNumber && 
                   billDate.getFullYear() === year;
        });

        weeklyStats.push({
            week: weekNumber,
            year,
            count: weekBills.length,
            revenue: weekBills.reduce((sum, bill) => sum + (bill.service?.cost || 0), 0),
            paid: weekBills.filter(b => b.has_paid).length
        });
    }
    stats.weekly = weeklyStats;

    // Get monthly stats (last 12 months)
    const monthlyStats = [];
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const monthBills = bills.filter(bill => {
            const billDate = new Date(bill.created_at);
            return billDate.getMonth() + 1 === month && 
                   billDate.getFullYear() === year;
        });

        monthlyStats.push({
            month,
            year,
            count: monthBills.length,
            revenue: monthBills.reduce((sum, bill) => sum + (bill.service?.cost || 0), 0),
            paid: monthBills.filter(b => b.has_paid).length
        });
    }
    stats.monthly = monthlyStats;

    // Get yearly stats (last 5 years)
    const yearlyStats = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 4; year <= currentYear; year++) {
        const yearBills = bills.filter(bill => {
            const billDate = new Date(bill.created_at);
            return billDate.getFullYear() === year;
        });

        yearlyStats.push({
            year,
            count: yearBills.length,
            revenue: yearBills.reduce((sum, bill) => sum + (bill.service?.cost || 0), 0),
            paid: yearBills.filter(b => b.has_paid).length
        });
    }
    stats.yearly = yearlyStats;

    return stats[time_range] || stats.monthly;
}

function getDepartmentStats(bills) {
    const deptMap = {};
    
    bills.forEach(bill => {
        const deptId = bill.department?.id || 'unknown';
        if (!deptMap[deptId]) {
            deptMap[deptId] = {
                name: bill.department?.name || 'Unknown Department',
                count: 0,
                revenue: 0,
                paid: 0
            };
        }
        
        deptMap[deptId].count++;
        deptMap[deptId].revenue += bill.service?.cost || 0;
        if (bill.has_paid) deptMap[deptId].paid++;
    });

    const departments = Object.values(deptMap);
    return {
        by_count: [...departments].sort((a, b) => b.count - a.count),
        by_revenue: [...departments].sort((a, b) => b.revenue - a.revenue),
        total_departments: departments.length
    };
}

function getServiceStats(bills) {
    const serviceMap = {};
    
    bills.forEach(bill => {
        const serviceId = bill.service?.id || 'unknown';
        if (!serviceMap[serviceId]) {
            serviceMap[serviceId] = {
                name: bill.service?.name || 'Unknown Service',
                cost: bill.service?.cost || 0,
                count: 0,
                revenue: 0,
                paid: 0
            };
        }
        
        serviceMap[serviceId].count++;
        serviceMap[serviceId].revenue += bill.service?.cost || 0;
        if (bill.has_paid) serviceMap[serviceId].paid++;
    });

    const services = Object.values(serviceMap);
    return {
        most_requested: [...services].sort((a, b) => b.count - a.count).slice(0, 5),
        highest_revenue: [...services].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        average_service_cost: services.reduce((sum, s) => sum + s.cost, 0) / services.length,
        total_services: services.length
    };
}

async function getDailyTrends(institution_id) {
    const results = await ServiceBill.findAll({
        attributes: [
            [sequelize.fn('DATE', sequelize.col('ServiceBill.created_at')), 'date'],
            [sequelize.fn('COUNT', sequelize.col('ServiceBill.id')), 'count'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN "has_paid" = true THEN 1 ELSE 0 END')), 'paid'],
            [sequelize.fn('SUM', sequelize.col('service.cost')), 'revenue']
        ],
        where: { institution_id },
        include: [{ model: Service, as: 'service', attributes: [] }],
        group: ['date'],
        order: [['date', 'ASC']],
        raw: true
    });

    return results.map(r => ({
        date: r.date,
        count: parseInt(r.count),
        paid: parseInt(r.paid),
        revenue: parseFloat(r.revenue || 0)
    }));
}

async function getWeeklyTrends(institution_id) {
    const results = await ServiceBill.findAll({
        attributes: [
            [sequelize.fn('DATE_TRUNC', 'week', sequelize.col('ServiceBill.created_at')), 'week'],
            [sequelize.fn('COUNT', sequelize.col('ServiceBill.id')), 'count'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN "has_paid" = true THEN 1 ELSE 0 END')), 'paid'],
            [sequelize.fn('SUM', sequelize.col('service.cost')), 'revenue']
        ],
        where: { institution_id },
        include: [{ model: Service, as: 'service', attributes: [] }],
        group: ['week'],
        order: [['week', 'ASC']],
        raw: true
    });

    return results.map(r => ({
        week: r.week,
        count: parseInt(r.count),
        paid: parseInt(r.paid),
        revenue: parseFloat(r.revenue || 0)
    }));
}

async function getMonthlyTrends(institution_id) {
    const results = await ServiceBill.findAll({
        attributes: [
            [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('ServiceBill.created_at')), 'month'],
            [sequelize.fn('COUNT', sequelize.col('ServiceBill.id')), 'count'],
            [sequelize.fn('SUM', sequelize.literal('CASE WHEN "has_paid" = true THEN 1 ELSE 0 END')), 'paid'],
            [sequelize.fn('SUM', sequelize.col('service.cost')), 'revenue']
        ],
        where: { institution_id },
        include: [{ model: Service, as: 'service', attributes: [] }],
        group: ['month'],
        order: [['month', 'ASC']],
        raw: true
    });

    return results.map(r => ({
        month: r.month,
        count: parseInt(r.count),
        paid: parseInt(r.paid),
        revenue: parseFloat(r.revenue || 0)
    }));
}

async function getPeriodStats(institution_id, period, value, month = null, year = null) {
    let where = { institution_id };
    let attributes = [
        [sequelize.fn('COUNT', sequelize.col('ServiceBill.id')), 'count'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN "has_paid" = true THEN 1 ELSE 0 END')), 'paid'],
        [sequelize.fn('SUM', sequelize.col('service.cost')), 'revenue']
    ];

    if (period === 'day') {
        where.created_at = {
            [Op.and]: [
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('DAY FROM "created_at"')), value),
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "created_at"')), month),
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "created_at"')), year)
            ]
        };
    } else if (period === 'week') {
        where.created_at = {
            [Op.and]: [
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('WEEK FROM "created_at"')), value),
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "created_at"')), month),
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "created_at"')), year)
            ]
        };
    } else if (period === 'month') {
        where.created_at = {
            [Op.and]: [
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "created_at"')), value),
                sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "created_at"')), year)
            ]
        };
    } else if (period === 'year') {
        where.created_at = sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "created_at"')), value);
    }

    const result = await ServiceBill.findOne({
        attributes,
        where,
        include: [{ model: Service, as: 'service', attributes: [] }],
        raw: true
    });

    return {
        count: parseInt(result?.count || 0),
        paid: parseInt(result?.paid || 0),
        revenue: parseFloat(result?.revenue || 0)
    };
}

function getTopPatientsByBills(bills) {
    const patientMap = {};
    
    bills.forEach(bill => {
        const patientId = bill.patient_id;
        if (!patientMap[patientId]) {
            patientMap[patientId] = {
                patient_id: patientId,
                count: 0,
                revenue: 0
            };
        }
        patientMap[patientId].count++;
        patientMap[patientId].revenue += bill.service?.cost || 0;
    });

    return Object.values(patientMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

function getTopPatientsBySpending(bills) {
    const patientMap = {};
    
    bills.forEach(bill => {
        const patientId = bill.patient_id;
        if (!patientMap[patientId]) {
            patientMap[patientId] = {
                patient_id: patientId,
                count: 0,
                revenue: 0
            };
        }
        patientMap[patientId].count++;
        patientMap[patientId].revenue += bill.service?.cost || 0;
    });

    return Object.values(patientMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getEmptyStatsTemplate() {
    return {
        overview: {
            total_bills: 0,
            total_revenue: 0,
            paid_bills: 0,
            unpaid_bills: 0,
            payment_success_rate: 0
        },
        time_based: {
            daily: [],
            weekly: [],
            monthly: [],
            yearly: []
        },
        department_stats: {
            by_count: [],
            by_revenue: [],
            total_departments: 0
        },
        service_stats: {
            most_requested: [],
            highest_revenue: [],
            average_service_cost: 0,
            total_services: 0
        },
        trends: {
            daily: [],
            monthly: [],
            weekly: []
        },
        current_period: {
            day: { count: 0, paid: 0, revenue: 0 },
            week: { count: 0, paid: 0, revenue: 0 },
            month: { count: 0, paid: 0, revenue: 0 },
            year: { count: 0, paid: 0, revenue: 0 }
        },
        patient_stats: {
            average_bills_per_patient: 0,
            top_patients_by_bills: [],
            top_patients_by_spending: []
        }
    };
}
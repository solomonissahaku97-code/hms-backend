const { ServiceBill, Service, Department, Patient, Sequelize } = require('../models');

exports.getStatisticsAndSummary = async (req, res) => {
    const { institution_id, start_date, end_date } = req.query;

    if (!institution_id) {
        return res.status(400).json({ error: 'Institution ID is required' });
    }

    try {
        const whereClause = { institution_id };

        // Validate and apply date filters if provided
        if (start_date || end_date) {
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
                return res.status(400).json({ error: 'Invalid date range' });
            }
            whereClause.created_at = {
                [Sequelize.Op.between]: [startDate, endDate]
            };
        }

        // Total revenue
        const totalRevenue = await ServiceBill.findAll({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('"ServiceBill"."total_amount"')), 'totalRevenue']
            ],
            where: { ...whereClause, has_paid: true },
            raw: true,
        }).then(result => result[0]?.totalRevenue || 0);



        // Total amount generated (paid + unpaid)
        const totalAmountGenerated = await ServiceBill.findAll({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('"ServiceBill"."total_amount"')), 'totalAmountGenerated']
            ],
            where: whereClause,
            raw: true,
        }).then(result => result[0]?.totalAmountGenerated || 0);




        // Paid and unpaid bill counts
        const paidBillsCount = await ServiceBill.count({
            where: { ...whereClause, has_paid: true }
        });

        const unpaidBillsCount = await ServiceBill.count({
            where: { ...whereClause, has_paid: false }
        });

        // Average Revenue per Bill
        const avgRevenuePerBill = totalRevenue / paidBillsCount || 0;

        // Revenue Trends Over Time (by day)
        const revenueTrends = await ServiceBill.findAll({
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('created_at')), 'day'],
                [Sequelize.fn('SUM', Sequelize.col('"ServiceBill"."total_amount"')), 'totalRevenue']
            ],
            where: { ...whereClause, has_paid: true },
            group: ['day'],
            order: [[Sequelize.col('day'), 'ASC']],
            raw: true
        });


        // Revenue per Department
        const revenuePerDepartment = await ServiceBill.findAll({
            attributes: [
                'department_id',
                [Sequelize.fn('SUM', Sequelize.col('"ServiceBill"."total_amount"')), 'totalRevenue']
            ],
            where: whereClause,
            group: ['ServiceBill.department_id', 'department.id', 'department.name'],
            include: [
                {
                    model: Department,
                    as: 'department',
                    attributes: ['id', 'name']
                }
            ],
            raw: true
        });




        // Outstanding payments
        const outstandingPayments = await ServiceBill.findAll({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('"ServiceBill"."total_amount"')), 'outstandingPayments'],
                'description',
                'service_type',
            ],
            where: {
                institution_id: institution_id,
                has_paid: false,
            },
            group: ['ServiceBill.description', 'ServiceBill.service_type'],
            raw: true,
        });


        const avgOutstandingPaymentPerDepartment = await ServiceBill.findAll({
            attributes: [
                'department_id',
                [Sequelize.fn('AVG', Sequelize.col('"ServiceBill"."total_amount"')), 'avgOutstandingPayment']
            ],
            where: {
                institution_id: institution_id,
                has_paid: false,
            },
            group: ['ServiceBill.department_id'],
            raw: true
        }).then(result => result.map(r => ({
            department_id: r.department_id,
            avgOutstandingPayment: r.avgOutstandingPayment || 0,
        })));




        // Top 5 Patients with Most Bills
        const topPatients = await ServiceBill.findAll({
            attributes: [
                'patient_id',
                [Sequelize.fn('COUNT', Sequelize.col('patient_id')), 'count']
            ],
            where: whereClause,
            group: ['patient_id', 'patient.first_name', 'patient.last_name'],
            order: [[Sequelize.literal('count'), 'DESC']],
            include: {
                model: Patient,
                as: 'patient',
                attributes: ['first_name', 'last_name']
            },
            raw: true,
            limit: 5
        });

        // Most billed services
        const mostBilledServices = await ServiceBill.findAll({
            attributes: [
                'description',
                'service_type',
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            where: whereClause,
            group: ['ServiceBill.description', 'ServiceBill.service_type'],
            order: [[Sequelize.literal('count'), 'DESC']],
            raw: true,
            limit: 5
        });


        // Most billed departments
        const mostBilledDepartments = await ServiceBill.findAll({
            attributes: [
                'department_id',
                [Sequelize.fn('COUNT', Sequelize.col('department_id')), 'count']
            ],
            where: whereClause,
            group: ['department_id', 'department.id', 'department.name'],
            order: [[Sequelize.literal('count'), 'DESC']],
            include: {
                model: Department,
                as: 'department',
                attributes: ['id', 'name']
            },
            limit: 5
        });

        // Response payload 
        const statistics = {
            totalRevenue: totalRevenue || 0,
            totalAmountGenerated: totalAmountGenerated || 0,
            paidBillsCount,
            unpaidBillsCount,
            avgRevenuePerBill,
            revenueTrends: revenueTrends.map(trend => ({
                day: trend.day,
                totalRevenue: trend.totalRevenue
            })),

            revenuePerDepartment: revenuePerDepartment
                .filter(dept => dept && dept['department.name'])
                .map(dept => ({
                    departmentName: dept['department.name'] || 'Unknown',
                    departmentId: dept.department_id,
                    totalRevenue: dept.totalRevenue || 0
                })),
            outstandingPayments: outstandingPayments || 0,
            avgOutstandingPaymentPerDepartment,
            topPatients: topPatients
                .filter(pat => pat && (pat['patient.first_name'] || pat['patient.last_name']))
                .map(patient => ({
                    patientName: `${patient['patient.first_name'] || ''} ${patient['patient.last_name'] || ''}`.trim() || 'Unknown',
                    patientId: patient.patient_id,
                    billCount: patient.count || 0
                })),
            mostBilledServices: mostBilledServices.map(service => ({
                serviceName: service.description || 'Unknown Service',
                serviceType: service.service_type,
                count: service.count || 0
            })),
            mostBilledDepartments: mostBilledDepartments
                .filter(dept => dept && dept['department.name'])
                .map(dept => ({
                    departmentName: dept['department.name'] || 'Unknown',
                    departmentId: dept.department_id,
                    count: dept.count || 0
                }))
        };

        return res.status(200).json({ success: true, data: statistics });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return res.status(500).json({ error: 'An error occurred while fetching statistics' });
    }
};


exports.getPatientBills = async (req, res) => {
    const { institution_id } = req.query;

    if (!institution_id) {
        return res.status(400).json({ error: 'Institution ID is required' });
    }

    try {
        const patientBills = await ServiceBill.findAll({
            where: { institution_id },
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    attributes: ['id', 'first_name', 'last_name'], // Customize attributes
                },
                {
                    model: Service,
                    as: 'service',
                    attributes: ['id', 'name', 'cost'],
                },
                {
                    model: Department,
                    as: 'department',
                    attributes: ['id', 'name'],
                },
            ],
            order: [['created_at', 'DESC']], // Optional: Sort by the latest bills
        });

        return res.status(200).json({ success: true, data: patientBills });
    } catch (error) {
        console.error('Error fetching patient bills:', error);
        return res.status(500).json({ error: 'An error occurred while fetching patient bills' });
    }
};

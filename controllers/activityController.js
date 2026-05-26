// Activity Controller - For fetching recent activities across the system
const { Patient, ServiceBill, Appointment, Admission, Prescription, LabTest, Staff, Department } = require('../models');
const { Op } = require('sequelize');
const Visit = require('../models/Visit');

// GET RECENT ACTIVITIES
exports.getRecentActivities = async (req, res) => {
    const { institution_id, limit = 10 } = req.query;

    try {
        const activities = [];
        const today = new Date();
        const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        // Get recent appointments
        const recentAppointments = await Appointment.findAll({
            where: {
                institution_id,
                created_at: {
                    [Op.gte]: oneDayAgo
                }
            },
            include: [
                {
                    model: Visit,
                    as: 'patient',
                }
            ],
            order: [['created_at', 'DESC']],
            limit: Math.floor(limit / 3)
        });

        recentAppointments.forEach(apt => {
            activities.push({
                id: `apt-${apt.id}`,
                type: 'appointment',
                description: `New appointment scheduled for ${apt.patient ? apt.patient.first_name + ' ' + apt.patient.last_name : 'patient'}`,
                time: getRelativeTime(apt.created_at),
                icon: 'calendar',
                color: 'cyan'
            });
        });

        // Get recent service bills/payments
        const recentBills = await ServiceBill.findAll({
            where: {
                institution_id,
                created_at: {
                    [Op.gte]: oneDayAgo
                }
            },
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    attributes: ['first_name', 'last_name']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: Math.floor(limit / 3)
        });

        recentBills.forEach(bill => {
            activities.push({
                id: `bill-${bill.id}`,
                type: 'billing',
                description: `Bill generated for ${bill.patient ? bill.patient.first_name + ' ' + bill.patient.last_name : 'patient'}`,
                time: getRelativeTime(bill.created_at),
                icon: 'dollar',
                color: 'blue'
            });
        });

        // Get recent admissions
        const recentAdmissions = await Admission.findAll({
            where: {
                institution_id,
                createdAt: {
                    [Op.gte]: oneDayAgo
                }
            },
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    include:[
                        {
                            model:Patient,
                            as:'patient'
                        }
                    ]
                },
                // {
                //     model: Department,
                //     as: 'department',
                //     attributes: ['name']
                // }
            ],
            order: [['createdAt', 'DESC']],
            limit: Math.floor(limit / 3)
        });

        recentAdmissions.forEach(admission => {
            activities.push({
                id: `adm-${admission.id}`,
                type: 'admission',
                description: `${admission.patient ? admission.patient.first_name + ' ' + admission.patient.last_name : 'Patient'} admitted to ${admission.department ? admission.department.name : 'Ward'}`,
                time: getRelativeTime(admission.created_at),
                icon: 'user-add',
                color: 'green'
            });
        });

        // Sort all activities by time (most recent first)
        activities.sort((a, b) => {
            const timeA = parseRelativeTime(a.time);
            const timeB = parseRelativeTime(b.time);
            return timeA - timeB;
        });

        // Return limited number of activities
        return res.status(200).json(activities.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        return res.status(500).json({ error: 'An error occurred while fetching recent activities' });
    }
};

// Helper function to get relative time string
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Helper function to parse relative time back to minutes for sorting
function parseRelativeTime(timeStr) {
    if (timeStr === 'Just now') return 0;
    const minsMatch = timeStr.match(/(\d+)\s*min/);
    if (minsMatch) return parseInt(minsMatch[1]);
    const hoursMatch = timeStr.match(/(\d+)\s*hour/);
    if (hoursMatch) return parseInt(hoursMatch[1]) * 60;
    const daysMatch = timeStr.match(/(\d+)\s*day/);
    if (daysMatch) return parseInt(daysMatch[1]) * 1440;
    return 999999; // Put unknown times at the end
}


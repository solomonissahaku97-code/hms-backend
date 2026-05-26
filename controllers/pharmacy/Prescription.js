;const { Prescription, Patient, Staff, Department, Institution, Visit } = require('../../models');
const { fn, col, literal, Op } = require('sequelize');
const sequelize = require('../../config/database');
const Medicine = require('../../models/claims/medication');
const ClinicalIntervention = require('../../models/ClinicalIntervention');
const { addClaimItem, updateClaimTotal } = require('../../service/claimService');
const ICD10ToGDRG = require('../../models/claims/ICD10ToGDRG');
const Claim = require('../../models/claims/claim');
const ClaimItem = require('../../models/claims/claimItem');
const Insurance = require('../../models/insuranceTable');
const ServiceBill = require('../../models/serviceBill');
const { handleBilling } = require('../../utils/billingUtil');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');
const Diagnosis = require('../../models/diagnosis');
const Notification = require('../../models/notification');

// Helper function to find Pharmacy department
async function findPharmacyDepartment(institution_id) {
    return await Department.findOne({
        where: {
            institution_id,
            departmentType: 'Pharmacy'
        }
    });
}

// Helper function to send notification to pharmacy department
async function notifyPharmacyDepartment(prescription, patient, medication, doctor, io) {
    try {
        const pharmacyDept = await findPharmacyDepartment(prescription.institution_id);
        
        if (pharmacyDept) {
            const notification = await Notification.create({
                title: 'New Prescription Request',
                description: `New prescription for patient ${patient.first_name} ${patient.last_name} - Medication: ${medication?.generic_name || 'N/A'}. Dosage: ${prescription.dosage}, Frequency: ${prescription.frequency}`,
                to_department_id: pharmacyDept.id,
                from_staff_id: prescription.prescribing_staff_id,
                institution_id: prescription.institution_id,
                type: 'Alert',
                priority: prescription.is_emergency ? 'High' : 'Medium'
            });
            console.log('Pharmacy notification sent:', notification.id);
            
            // Emit real-time notification to department room
            if (io) {
                io.to(`department-${pharmacyDept.id}`).emit('new-department-notification', notification);
            }
            
            return notification;
        } else {
            console.log('Pharmacy department not found for institution:', prescription.institution_id);
        }
    } catch (error) {
        console.error('Error sending pharmacy notification:', error);
    }
}

// Helper function to notify doctor when prescription is dispensed
async function notifyDoctorOnDispense(prescription, patient, medication, pharmacist, io) {
    try {
        // Get the doctor's staff_id (either prescribing_staff_id or doctor_id)
        const doctorId = prescription.prescribing_staff_id || prescription.doctor_id;
        
        if (doctorId) {
            const notification = await Notification.create({
                title: 'Prescription Dispensed',
                description: `Your prescription for patient ${patient.first_name} ${patient.last_name} has been dispensed. Medication: ${medication?.generic_name || 'N/A'}. Quantity: ${prescription.quantity}`,
                to_staff_id: doctorId,
                from_staff_id: prescription.dispensed_by,
                institution_id: prescription.institution_id,
                type: 'Alert',
                priority: 'Medium'
            });
            console.log('Doctor notification sent:', notification.id);
            
            // Emit real-time notification to staff
            if (io) {
                io.to(`staff-${doctorId}`).emit('new-notification', notification);
            }
            
            return notification;
        } else {
            console.log('Doctor ID not found for prescription:', prescription.id);
        }
    } catch (error) {
        console.error('Error sending doctor notification:', error);
    }
}


// Create prescription(s) - handles both single and multiple
exports.createPrescription = async (req, res) => {
    try {
        const data = req.body;

        // Check if it's an array (multiple prescriptions)
        if (Array.isArray(data)) {
            return await createMultiplePrescriptions(data, res, req);
        } else {
            return await createSinglePrescription(data, res, req);
        }
    } catch (error) {
        console.error('Error creating prescription(s):', error);
        res.status(500).json({ error: error.message });
    }
};

// Helper function for multiple prescriptions
async function createMultiplePrescriptions(prescriptionsData, res, req) {
    // Get io from app for real-time notifications
    const io = req.app ? req.app.get('io') : null;
    
    // Basic validation for each prescription
    console.log('Received prescriptions data:', JSON.stringify(prescriptionsData, null, 2));
    for (const prescription of prescriptionsData) {
        const {
            medication_id,
            department_id,
            visit_id,
            dosage,
            frequency,
            duration,
            institution_id
        } = prescription;

        if (!medication_id || !department_id || !visit_id || !dosage || !frequency || !institution_id) {
            return res.status(400).json({
                error: `Missing required fields for medication: ${prescription.medication_data?.generic_name || 'Unknown'}`
            });
        }
    }

    const createdPrescriptions = [];
    const today = new Date();

    for (const prescriptionData of prescriptionsData) {
        const {
            medication_id,
            department_id,
            visit_id,
            dosage,
            frequency,
            duration,
            notes,
            prescribing_staff_id,
            refill,
            is_emergency,
            institution_id,
            doseUnitType,
            route,
            doctor_id
        } = prescriptionData;

        // Calculate end date only
        const calculateEndDate = new Date(today);
        calculateEndDate.setDate(today.getDate() + Number(duration));

        const prescription = await Prescription.create({
            medication_id,
            department_id,
            visit_id,
            dosage,
            frequency,
            duration: duration || 1,
            notes,
            prescribing_staff_id,
            refill: refill || 0,
            is_emergency: is_emergency || false,
            institution_id,
            doctor_id,
            doseUnitType,
            route,
            end_date: calculateEndDate
        });

        // Get patient info for notification
        let patient = null;
        if (visit_id) {
            const visit = await Visit.findByPk(visit_id);
            if (visit) {
                patient = await Patient.findByPk(visit.patient_id);
            }
        }
        
        // Get medication info for notification
        const medication = await Medicine.findByPk(medication_id);
        
        // Get doctor info for notification
        const doctor = prescribing_staff_id ? await Staff.findByPk(prescribing_staff_id) : null;

        // Send notification to Pharmacy department
        await notifyPharmacyDepartment(prescription, patient, medication, doctor, io);

        createdPrescriptions.push(prescription);
    }

    console.log(`Created ${createdPrescriptions.length} prescriptions`);
    res.status(201).json(createdPrescriptions);
}

// Helper function for single prescription
async function createSinglePrescription(prescriptionData, res, req) {
    // Get io from app for real-time notifications
    const io = req.app ? req.app.get('io') : null;
    
    console.log('Received prescriptions data:', JSON.stringify(prescriptionData, null, 2));

    const {
        medication_id,
        department_id,
        visit_id,
        dosage,
        frequency,
        duration,
        notes,
        prescribing_staff_id,
        refill,
        is_emergency,
        institution_id,
        doseUnitType,
        route,
        doctor_id
    } = prescriptionData;

    // Basic validation
    if (!medication_id || !department_id || !visit_id || !dosage || !frequency || !institution_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const today = new Date();
    const calculateEndDate = new Date(today);
    calculateEndDate.setDate(today.getDate() + Number(duration));

    const prescription = await Prescription.create({
        medication_id,
        department_id,
        visit_id,
        dosage,
        frequency,
        duration: duration || 1,
        notes,
        prescribing_staff_id,
        refill: refill || 0,
        is_emergency: is_emergency || false,
        institution_id,
        quantity: 0, // Pharmacist will set this
        doctor_id,
        doseUnitType,
        route,
        end_date: calculateEndDate
    });

    // Get patient info for notification
    let patient = null;
    if (visit_id) {
        const visit = await Visit.findByPk(visit_id);
        if (visit) {
            patient = await Patient.findByPk(visit.patient_id);
        }
    }
    
    // Get medication info for notification
    const medication = await Medicine.findByPk(medication_id);
    
    // Get doctor info for notification
    const doctor = prescribing_staff_id ? await Staff.findByPk(prescribing_staff_id) : null;

    // Send notification to Pharmacy department
    await notifyPharmacyDepartment(prescription, patient, medication, doctor, io);

    console.log(prescription);
    res.status(201).json(prescription);
}

// Get all prescriptions
exports.getAllPrescriptions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 30,
            status,
            is_emergency,
            patient_id,
            staff_id,
            department_id,
            institution_id,
            start_date,
            end_date
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (status) where.status = status;
        if (is_emergency) where.is_emergency = is_emergency;
        if (department_id) where.department_id = department_id;
        if (institution_id) where.institution_id = institution_id;
        if (start_date && end_date) {
            where.createdAt = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        }

        // If patient_id is provided, find via visits
        if (patient_id) {
            const visits = await Visit.findAll({
                where: { patient_id },
                attributes: ['id']
            });
            where.visit_id = visits.map(v => v.id);
        }

        // If staff_id is provided (prescribing doctor)
        if (staff_id) where.prescribing_staff_id = staff_id;

        const prescriptions = await Prescription.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                {
                    model: Visit, as: 'visit', include: [
                        {
                            model: Patient,
                            as: "patient"
                        }
                    ]
                },
                { model: Staff, as: 'prescribingStaff' },
                { model: Staff, as: 'doctor' },
                { model: Department, as: 'department' },
                { model: Institution, as: 'institution' },
                { model: ClinicalIntervention, as: 'clinicalInterventions' },
                { model: Medicine, as: 'medicine' },
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            total: prescriptions.count,
            page: parseInt(page),
            pages: Math.ceil(prescriptions.count / limit),
            data: prescriptions.rows
        });
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get single prescription by ID
exports.getPrescriptionById = async (req, res) => {
    try {
        const prescription = await Prescription.findByPk(req.params.id, {
            include: [
                { model: Visit, as: 'visit' },
                { model: Staff, as: 'prescribingStaff' },
                { model: Department, as: 'department' },
                { model: Institution, as: 'institution' }
            ]
        });

        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        res.json(prescription);
    } catch (error) {
        console.error('Error fetching prescription:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update a prescription
exports.updatePrescription = async (req, res) => {
    try {
        const prescription = await Prescription.findByPk(req.params.id);

        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        // Only allow certain fields to be updated
        const updatableFields = [
            'dosage',
            'frequency',
            'duration',
            'notes',
            'refill',
            'status',
            'is_emergency'
        ];

        const updates = {};
        for (const field of updatableFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        // Recalculate dates if duration changed
        if (updates.duration) {
            const today = new Date();
            updates.start_date = today;
            updates.end_date = new Date(today.setDate(today.getDate() + updates.duration));
        }

        await prescription.update(updates);
        res.json(prescription);
    } catch (error) {
        console.error('Error updating prescription:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete a prescription (soft delete)
exports.deletePrescription = async (req, res) => {
    try {
        const prescription = await Prescription.findByPk(req.params.id);

        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        // Soft delete
        await prescription.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting prescription:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get prescriptions by visit ID
exports.getPrescriptionsByVisit = async (req, res) => {
    try {
        const prescriptions = await Prescription.findAll({
            where: { visit_id: req.params.visitId },
            include: [
                {
                    model: Visit, as: 'visit', include: [
                        {
                            model: Patient,
                            as: "patient"
                        },

                        {
                            model: Claim,
                            as: "claims",
                            include: [
                                {
                                    model: ClaimItem,
                                    as: "items"
                                }
                            ]
                        },
                        {
                            model: Diagnosis, as: 'diagnosis',
                            include: [
                                {
                                    model: systemDiagnosis,
                                    as: 'systemDiagnosis'
                                }
                            ]

                        },

                    ]
                },
                { model: Staff, as: 'prescribingStaff' },
                { model: Staff, as: 'doctor' },
                { model: Department, as: 'department' },
                { model: Institution, as: 'institution' },
                { model: Medicine, as: 'medicine' },
                { model: ClinicalIntervention, as: 'clinicalInterventions' }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions by visit:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update prescription status
exports.updatePrescriptionStatus = async (req, res) => {
    // Get io from app for real-time notifications
    const io = req.app ? req.app.get('io') : null;
    
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { status, claim_id, dispensed_quantity, pharmacist_notes, patient_id } = req.body;
        console.log(req.body)

        // 1. Fetch prescription and related medication with visit
        const prescription = await Prescription.findByPk(req.params.id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'institution_id'] // Include necessary fields
                },
                {
                    model: Medicine,
                    as: 'medicine'
                }
            ],
            transaction
        });

        if (!prescription) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Prescription not found' });
        }

        if (!prescription.visit) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Prescription is not associated with a visit' });
        }

        const medication = await Medicine.findByPk(prescription.medication_id, { transaction });
        if (!medication) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Medication not found' });
        }

        // 2. If status is 'dispensed', validate dispensed quantity
        if (status === 'dispensed') {
            if (!dispensed_quantity || dispensed_quantity <= 0) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Dispensed quantity is required and must be greater than 0' });
            }

            // if (dispensed_quantity > prescription.quantity) {
            //     await transaction.rollback();
            //     return res.status(400).json({ 
            //         error: `Dispensed quantity (${dispensed_quantity}) cannot exceed prescribed quantity (${prescription.quantity})` 
            //     });
            // }

            // Update the dispensed quantity and pharmacist notes
            prescription.quantity = dispensed_quantity;
            prescription.pharmacist_notes = pharmacist_notes || '';
            prescription.dispensed_at = new Date();
            prescription.dispensed_by = req.user?.id; // Assuming user info is in request
            prescription.is_dispensed = true;
            prescription.save({ transaction });
        }

        // 3. Process billing using handleBilling (with all required parameters)
        const billingResult = await handleBilling({
            transaction,
            patient_id: prescription.visit.patient_id, // From visit
            visit_id: prescription.visit.id,           // From visit
            institution_id: prescription.visit.institution_id, // From visit
            service_id: prescription.id,
            service_type: "Medication",
            description: `${medication.generic_name} - ${dispensed_quantity || prescription.quantity} units`,
            unit_price: medication.market_price,
            nhia_unit_price: medication.nhia_price || 0,
            quantity: dispensed_quantity || prescription.quantity, // Use dispensed quantity if available
            department_id: prescription.department_id,
            claim_id: claim_id
        });

        console.log({
            patient_id: prescription.visit.patient_id,
            visit_id: prescription.visit.id,
            institution_id: prescription.visit.institution_id,
            service_id: prescription.id,
            service_type: "Medication",
            description: medication.generic_name,
            unit_price: medication.market_price,
            nhia_unit_price: medication.nhia_price || 0,
            quantity: dispensed_quantity || prescription.quantity,
            department_id: prescription.department_id,
            claim_id: claim_id
        });

        console.log(billingResult);

        // 4. Update prescription status and other fields
        const updateData = {
            status,
            billing_reference: billingResult,
            billed_at: new Date() // Track when billing occurred
        };

        // Only add dispensed-related fields if status is 'dispensed'
        if (status === 'dispensed') {
            updateData.dispensed_quantity = dispensed_quantity;
            updateData.pharmacist_note = pharmacist_notes;
            updateData.dispensed_at = new Date();
            updateData.dispensed_by = req.user?.id;
        }

        // If status is 'canceled', add cancellation info
        if (status === 'canceled') {
            updateData.canceled_at = new Date();
            updateData.canceled_by = req.user?.id;
        }

        await prescription.update(updateData, { transaction });

        // Commit the transaction first
        await transaction.commit();

        // If prescription is dispensed, notify the doctor
        if (status === 'dispensed') {
            // Get patient info for notification
            const patient = await Patient.findByPk(prescription.visit.patient_id);
            
            // Get medication info for notification (already fetched earlier)
            const pharmacist = prescription.dispensed_by ? await Staff.findByPk(prescription.dispensed_by) : null;

            // Send notification to doctor
            await notifyDoctorOnDispense(prescription, patient, medication, pharmacist, io);
        }

        res.json({
            message: `Prescription ${status} successfully`,
            prescription: await Prescription.findByPk(req.params.id, {
                include: [
                    { model: Visit, as: 'visit' },
                    { model: Medicine, as: 'medicine' }
                ]
            }),
            billing: billingResult
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error updating prescription:", error);
        res.status(500).json({
            error: "Failed to update prescription",
            details: error.message
        });
    }
};




exports.getPharmacyDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Core Metrics
        const coreMetrics = await Prescription.findAll({
            attributes: [
                [fn('COUNT', col('id')), 'total'],
                [literal(`COUNT(CASE WHEN status = 'dispensed' THEN 1 END)`), 'dispensed'],
                [literal(`COUNT(CASE WHEN status = 'canceled' THEN 1 END)`), 'canceled'],
                [literal(`COUNT(CASE WHEN "is_emergency" = true THEN 1 END)`), 'emergency'],
                [fn('SUM', col('quantity')), 'total_quantity'],
                [fn('AVG', col('quantity')), 'avg_quantity'],
                [fn('SUM', col('refill')), 'total_refills']
            ],
            raw: true
        });

        // 2. Today's Activity
        const todaysActivity = await Prescription.findAll({
            attributes: [
                [literal(`COUNT(CASE WHEN "created_at" >= :today THEN 1 END)`), 'created_today'],
                [literal(`COUNT(CASE WHEN status = 'dispensed' AND "updated_at" >= :today THEN 1 END)`), 'dispensed_today']
            ],
            replacements: { today },
            raw: true
        });

        // 3. Active Prescriptions
        const activePrescriptions = await Prescription.count({
            where: {
                status: { [Op.ne]: 'canceled' },
                start_date: { [Op.lte]: new Date() },
                end_date: { [Op.gte]: new Date() }
            }
        });

        // 4. Top Medications
        const topMedications = await Prescription.findAll({
            attributes: [
                'medication_id',
                [fn('COUNT', col('Prescription.id')), 'prescription_count'],
                [fn('SUM', col('quantity')), 'total_quantity']
            ],
            include: [{ model: Medicine, as: 'medicine' }],
            group: ['medication_id', 'medicine.id'],
            order: [[literal('prescription_count'), 'DESC']],
            limit: 10,
            raw: true,
            nest: true
        });

        // 5. Department Breakdown
        const departmentStats = await Department.findAll({
            attributes: [
                'id',
                'name',
                [fn('COUNT', col('prescriptions.id')), 'prescription_count'],
                [literal(`COUNT(CASE WHEN prescriptions.is_emergency = true THEN 1 END)`), 'emergency_count']
            ],
            include: [
                {
                    model: Prescription,
                    as: 'prescriptions',
                    attributes: []
                }
            ],
            group: ['Department.id'],
            order: [[literal('"prescription_count"'), 'DESC']], // quoting needed for Postgres alias
            raw: true
        });




        // 6. Duration Analysis
        const durationStats = await Prescription.findAll({
            attributes: [
                [fn('AVG', col('duration')), 'avg_duration'],
                [literal(`AVG(EXTRACT(EPOCH FROM (end_date - start_date))/86400)`), 'avg_duration_days']
            ],
            raw: true
        });

        // 7. Ending Soon
        const endingSoon = await Prescription.count({
            where: {
                end_date: {
                    [Op.between]: [new Date(), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)]
                },
                status: { [Op.ne]: 'canceled' }
            }
        });

        res.json({
            status: 'success',
            data: {
                core: coreMetrics[0],
                today: todaysActivity[0],
                active_prescriptions: activePrescriptions,
                top_medications: topMedications,
                departments: departmentStats,
                duration: durationStats[0],
                ending_soon: endingSoon
            }
        });

    } catch (error) {
        console.error('Pharmacy Dashboard Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate pharmacy statistics'
        });
    }
};


// get dispense history
exports.getDispenseHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const where = {
            status: 'dispensed'
        };

        if (start_date && end_date) {
            where.updated_at = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        }

        const { count, rows } = await Prescription.findAndCountAll({
            where,
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    include: [
                        {
                            model: Patient,
                            as: "patient"
                        }
                    ]
                },
                { model: Staff, as: 'prescribingStaff' },
                { model: Staff, as: 'doctor' },
                { model: Department, as: 'department' },
                { model: Institution, as: 'institution' },
                { model: Medicine, as: 'medicine' },
                { model: ClinicalIntervention, as: 'clinicalInterventions' }
            ],
            order: [['updated_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            total: count,
            page: parseInt(page),
            pages: Math.ceil(count / limit),
            data: rows
        });
    } catch (error) {
        console.error('Error fetching dispense history:', error);
        res.status(500).json({ error: error.message });
    }
};


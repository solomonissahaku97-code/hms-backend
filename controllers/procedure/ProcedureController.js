const Institution = require("../../models/institution");
const Patient = require("../../models/patient");
const Procedure = require("../../models/procedure/procedure");
const ProcedureStaff = require("../../models/ProcedureStaff");
const Staff = require("../../models/staff");
const Visit = require("../../models/Visit");
const GDRGCode = require("../../models/claims/GDRGCode");
const sequelize = require('../../config/database')
const { handleBilling } = require('../../utils/billingUtil')

const ProcedureController = {
    /**
     * @desc Add a new procedure
     * @route POST /procedures
     */
    async addProcedures(req, res) {
        try {
            const {
                visit_id,
                institution_id,
                procedures, // Array of procedure objects
                staff_assistance = [], // Array of staff IDs
                doctor_id, // Main doctor ID
                department_id,
                procedure_datetime,
                description,
                nhia_covered,
                claim_id
            } = req.body;

            // Validate required fields
            if (!visit_id || !procedures || !Array.isArray(procedures) || !doctor_id) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Check if patient exists
            const patient = await Visit.findByPk(visit_id);
            if (!patient) return res.status(404).json({ error: 'Patient not found' });

            // Check institution if provided
            if (institution_id) {
                const institution = await Institution.findByPk(institution_id);
                if (!institution) return res.status(404).json({ error: 'Institution not found' });
            }

            // Combine main doctor ID with assisting staff for validation
            const allStaffIds = [...new Set([doctor_id, ...staff_assistance])];
            const procedureCodes = procedures.map(p => p.procedure_id || p); // Handle both object and string IDs

            // Check all staff and procedures exist in parallel
            const [staffMembers, gdrgCodes] = await Promise.all([
                Staff.findAll({ where: { id: allStaffIds } }),
                GDRGCode.findAll({ where: { id: procedureCodes } })
            ]);

            if (staffMembers.length !== allStaffIds.length) {
                return res.status(404).json({ error: 'One or more staff members not found' });
            }
            if (gdrgCodes.length !== procedureCodes.length) {
                return res.status(404).json({ error: 'One or more procedure codes not found' });
            }

            // Create all procedures in a transaction
            const createdProcedures = await sequelize.transaction(async (transaction) => {
                const procedureCreations = procedures.map(proc =>
                    Procedure.create({
                        selected_procedure_id: typeof proc === 'string' ? proc : proc.procedure_id,
                        description: typeof proc === 'string' ? '' : proc.description || description || '',
                        visit_id,
                        institution_id,
                        doctor_id,
                        department_id: typeof proc === 'string' ? department_id : proc.department_id || department_id,
                        procedure_datetime: typeof proc === 'string' ? procedure_datetime : proc.procedure_datetime || procedure_datetime || new Date()
                    }, { transaction })
                );

                const results = await Promise.all(procedureCreations);
                const procedureIds = results.map(p => p.id);

                // Add assisting staff to all procedures if provided
                if (staff_assistance.length > 0) {
                    const staffRecords = staff_assistance.flatMap(staff_id =>
                        procedureIds.map(procedure_id => ({
                            procedure_id,
                            staff_id,
                            role: 'assistant'
                        }))
                    );
                    await ProcedureStaff.bulkCreate(staffRecords, { transaction });
                }




                return results;
            });

            return res.status(201).json({
                message: 'Procedures added successfully',
                procedures: createdProcedures
            });
        } catch (error) {
            console.error('Error adding procedures:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
    * @desc Add a new procedure
    * @route POST /procedures
    */
    async getPatientProcedures(req, res) {
        const { patient_id, institution_id } = req.query

        try {
            const procedures = await Procedure.findAll({
                where: {
                    patient_id,
                    institution_id
                },
                include: [
                    {
                        model: Patient,
                        as: 'patient',
                        attributes: ['name', 'email']
                    },
                    {
                        model: Institution,
                        as: 'institution',
                        attributes: ['name']
                    },
                    {
                        model: Staff,
                        as: 'doctor',
                        attributes: ['name']
                    },
                    {
                        model: ProcedureStaff,
                        as: 'assisting_staff',

                    }
                ]
            });
            return res.status(200).json(procedures);


        } catch (error) {
            console.error('Error getting patient procedures:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * @desc Remove an assisting staff from a procedure
     * @route DELETE /procedures/remove-staff
     */
    async removeStaffFromProcedure(req, res) {
        try {
            const { procedure_id, staff_id, institution_id } = req.body;

            const procedureStaff = await ProcedureStaff.findOne({ where: { procedure_id, staff_id } });
            if (!procedureStaff) {
                return res.status(404).json({ error: 'Staff not found in this procedure' });
            }

            await procedureStaff.destroy();
            return res.status(200).json({ message: 'Staff removed from procedure' });
        } catch (error) {
            console.error('Error removing staff:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * @desc Delete a procedure (removes all associated staff)
     * @route DELETE /procedures/:procedure_id
     */

    async deleteProcedure(req, res) {
        try {
            const { procedure_id } = req.query;

            const procedure = await Procedure.findByPk(procedure_id);
            if (!procedure) {
                return res.status(404).json({ error: 'Procedure not found' });
            }

            // Remove associated staff from procedure
            await ProcedureStaff.destroy({ where: { procedure_id } });

            // Delete the procedure itself
            await procedure.destroy();

            return res.status(200).json({ message: 'Procedure deleted successfully' });
        } catch (error) {
            console.error('Error deleting procedure:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async getAllProcedures(req, res) {
        try {
            const { page = 1, limit = 10, institution_id } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await Procedure.findAndCountAll({
                include: [
                    // ... same includes as above ...
                    {
                        model: Visit,
                        as: 'visit',
                        // include:[
                        //     {
                        //         model:PatientEducation,
                        //         as:'patient_education'
                        //     }
                        // ]
                    },
                  
                    {
                        model: Staff,
                        as: 'doctor',
                        exclude: ['password', 'email']
                    },
                    // {
                    //     model: ProcedureStaff,
                    //     as: 'assisting_staff',

                    // }
                ],

                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                where: {
                    institution_id
                }
            },);

            return res.status(200).json({
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
                procedures: rows
            });
        } catch (error) {
            // ... error handling ...
            console.error('Error fetching procedures:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async updateProcedureStatus(req, res) {
        const { procedure_id, status, visit_id, patient_id, institution_id,claim_id } = req.body;
        const transaction = await sequelize.transaction();
        console.log(req.body)

        try {
            // 1. Validate status
            const validStatuses = ['pending', 'scheduled', 'ongoing', 'completed', 'canceled'];
            if (!validStatuses.includes(status)) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Invalid status' });
            }

            // 2. Find the procedure (lock for update)
            const procedure = await Procedure.findByPk(procedure_id, {
                transaction,
                lock: transaction.LOCK.UPDATE,

            });
            if (!procedure) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Procedure not found' });
            }

            // 3. Update status
            const previousStatus = procedure.status;
            procedure.status = status;
            await procedure.save({ transaction });

            // get gdrg code from procedure
            const gdrgCode = await GDRGCode.findByPk(procedure.selected_procedure_id);
            if (!gdrgCode) {
                await transaction.rollback();
                return res.status(404).json({ error: 'GDRG Code not found for this procedure' });
            }

            // 4. Trigger billing ONLY if status changed to "ongoing"
            let billingResult = null;
            if (status === 'ongoing' && previousStatus !== 'ongoing' || status === 'completed') {
                billingResult = await handleBilling({
                    transaction,
                    patient_id: patient_id,
                    service_id: procedure_id,
                    service_type: 'Procedure', // Fixed type for procedures
                    description: gdrgCode.description || `Procedure #${procedure_id}`,
                    nhia_unit_price: gdrgCode.nhia_price,
                    unit_price: gdrgCode.market_price,
                    quantity: 1, // Procedures always have quantity=1
                    department_id: procedure.department_id,
                    visit_id,
                    institution_id,
                    claim_id
                });

                // Optional: Update procedure with billing reference
                procedure.billing_reference = billingResult;
                await procedure.save({ transaction });
            }

            // 5. Commit if successful
            await transaction.commit();

            return res.status(200).json({
                message: 'Procedure status updated successfully',
                procedure,
                billing: billingResult
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Error updating procedure status:', error);
            return res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }






};

module.exports = ProcedureController;

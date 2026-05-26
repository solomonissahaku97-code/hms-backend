const Institution = require('../../models/institution');
const Patient = require('../../models/patient');
const Staff = require('../../models/staff');
const sequelize = require('../../config/database');
const Department = require('../../models/department');
const Role = require('../../models/role');
const Bed = require('../../models/beds');
const Diagnosis = require('../../models/diagnosis');
const softwareCharges = require('../../helpers/softwareChargesHandlers')

const redisClient = require('../../redis/redisClient'); // Redis setup
const RotationStaff = require('../../models/rotationStaff');
const Visit = require('../../models/Visit');

exports.createDepartment = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction(); // Start transaction

        const { name, numberOfBeds, institution_id, description, departmentType } = req.body;

        // Ensure institution exists
        const institution = await Institution.findByPk(institution_id, { transaction });
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        // Generate unique department_number
        const department_number = '#' + Math.floor(10000000 + Math.random() * 90000000).toString();

        // Create department
        const department = await Department.create({
            name,
            institution_id,
            description,
            department_number,
            departmentType
        }, { transaction });

        // Create beds only if numberOfBeds > 0
        const bedCount = Number(numberOfBeds) || 0;
        if (bedCount > 0) {
            const beds = Array.from({ length: bedCount }, (_, i) => ({
                bed_number: i + 1,
                status: 'available',
                department_id: department.id,
                institution_id: institution_id
            }));
            await Bed.bulkCreate(beds, { transaction });
        }

        await transaction.commit();

        res.status(201).json({ message: 'Department created successfully', department });
    } catch (error) {
        if (transaction) await transaction.rollback(); // Rollback only if transaction started
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};




// Update department beds
exports.updateDepartmentBeds = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { total_beds } = req.body;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({ error: 'Department not found.' });
        }

        department.total_beds = total_beds;
        await department.save();
        res.status(200).json(department);
    } catch (error) {
        res.status(500).json({ error: 'Error updating department beds.' });
    }
};

// Get all departments with the total number of patients and staff in each department for a specific institution
exports.getDepartmentsByInstitution = async (req, res) => {
    const { institution_id } = req.query;

    try {
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        const departments = await Department.findAll({
            where: { institution_id },
            include: [
                {
                    model: Visit,
                    as: 'patients',
                },
                {
                    model: Staff,
                    as: 'staff',
                    include:[
                        { model: RotationStaff, as: "rotation" },

                        {
                            model: Role,
                            as: 'role'
                        },
                    ]
                },
                {
                    model: Bed,
                    as: 'bed',
                },



            ],
        });

        res.status(200).json(departments);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Error retrieving departments.' });
    }
};

// get a single departments
exports.getDepartment = async (req, res) => {
    const {  department_id } = req.query;

    try {
        // Check if the institution exists
        // const institution = await Institution.findByPk(institution_id);
        // if (!institution) {
        //     return res.status(404).json({ error: 'Institution not found.' });
        // }

        // Find the department with the specified institution_id and department_id, including related patients and staff
        const department = await Department.findAll({
            where: {  id: department_id }, // Corrected: Use id for department_id
            include: [
                {
                    model: Visit,
                    as: 'patients',
                    include: [
                        {
                            model: Bed,
                            as: 'bed',
                        },
                    ]
                },
                {
                    model: Staff,
                    as: 'staff',
                   
                },
               
                {
                    model:Bed,
                    as:'bed'
                }

            ], 
        });

        // Check if department exists
        if (!department) {
            return res.status(404).json({ error: 'Department not found.' });
        }

        // Return the department with its patients and staff
        res.status(200).json(department);

    } catch (error) {
        // Handle errors and send a response
        console.log(error);
        res.status(500).json({ error: 'Error retrieving department.' });
    }
};



// Add a staff member to a department
exports.addStaffToDepartment = async (req, res) => {
    try {
        const { departmentId, staffId, institution_id } = req.body;

        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({ error: 'Department not found.' });
        }

        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution does not match.' });
        }

        const staff = await Staff.findByPk(staffId);
        if (!staff) {
            return res.status(404).json({ error: `Staff with ID ${staffId} not found.` });
        }

        staff.department_id = departmentId;
        await staff.save();

        return res.status(200).json({ message: 'Staff added to department successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Error adding staff to department.' });
    }
};


// Remove a staff member from a department
exports.removeStaffFromDepartment = async (req, res) => {
    try {
        const { staffId, institutionId, departmentId } = req.body;

        const staff = await Staff.findOne({ where: { id: staffId, institution_id: institutionId, department_id: departmentId } });
        if (!staff) {
            return res.status(404).json({ error: `Staff with ID ${staffId} not found or does not belong to department` });
        }

        if (staff.institution_id !== institutionId) {
            return res.status(400).json({ error: 'Institution ID does not match the staff\'s institution.' });
        }

        staff.department_id = null;
        await staff.save();

        res.status(200).json({ message: 'Staff removed from department successfully.' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ "message": 'Error removing staff from department.', "error": error });
    }
};


// Get all staff members from a specific institution
exports.getStaffByInstitution = async (req, res) => {
    const { institution_id } = req.params;

    try {
        // Ensure institution exists
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        // Get all staff members for the institution
        const staff = await Staff.findAll({
            where: { institution_id },
            include: [
                { model: Role, as: "role" },
                { model: Department, as: "department" },
                { model: RotationStaff, as: "rotation" },

            ]
        });

        res.status(200).json(staff);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Error retrieving staff.' });
    }
};


// Get all patient in a department
exports.getAllPatientFromDepartment = async (req, res) => {
    const { institution_id, department_id } = req.params
    try {
        const department = await Department.findOne({ where: { institution_id: institution_id, id: department_id } })
        if (!department) return res.status(400).json({ error: 'Department does not exist' })

        const allPatients = await Patient.findAll({
            where: { department_id: department_id },
            include: [
                {
                    model: Bed,
                    as: 'bed',
                },
            ]
        })
        res.status(200).json(allPatients)
    } catch (error) {
        console.log(error)
    }
}

exports.getDepartmentSummaryWithDiagnosisDetails = async (req, res) => {
    const { institution_id, department_id } = req.query;
}

// delete a department
exports.deleteDepartment = async (req, res) => {
    try {
        const { department_id } = req.params;
        console.log(req.params)
        
        const department = await Department.findByPk(department_id);
        if (!department) {
            return res.status(404).json({ error: 'Department not found.' });
        }

        await department.destroy();
        res.status(200).json({ message: 'Department deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error deleting department.' });
    }
}; 


















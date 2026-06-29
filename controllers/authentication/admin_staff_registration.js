const Admin = require("../../models/admin");
const Department = require("../../models/department");
const Institution = require("../../models/institution");
const Role = require("../../models/role");
const Staff = require("../../models/staff");
const { encrypt, decrypt } = require('../../utils/encryption'); // Adjust the path to your encryption file
const bcrypt = require('bcryptjs')
const { sendSMS } = require('../../service/smsService'); // Adjust the path accordingly
const sendEmail = require('../../service/sendEmail');
const Attendance = require("../../models/Attendance");
const RotationStaff = require("../../models/rotationStaff");
const LeaveRequest = require("../../models/hr/LeaveManagement");
const Appointment = require("../../models/appointment");
const StaffDepartment = require("../../models/controls/StaffDepartment");
const sequelize = require("../../config/database");
const generateStaffQrCode = require("../../utils/generateStaffQrCode");

const getInstitutionInitials = (name) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
};


exports.registerStaffs = async (req, res) => {
    const {
        firstName,
        middleName,
        lastName,
        email,
        password,
        institution_id,
        admin_id,
        department_id,
        role_id,
        phoneNumber,
        is_incharge,
        department_ids = [],
        primary_department_id
    } = req.body;

    const trimmedEmail = String(email).toLowerCase().trim();

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
        // Validate institution
        const institution = await Institution.findByPk(institution_id, { transaction });
        if (!institution) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Invalid institution_id' });
        }

        // Validate admin
        const admin = await Admin.findByPk(admin_id, { transaction });
        if (!admin) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Invalid admin_id' });
        }

        // Validate role if provided
        let role = null;
        if (role_id) {
            role = await Role.findByPk(role_id, { transaction });
            if (!role) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Invalid role_id' });
            }
        }

        // Validate department_ids if provided
        if (department_ids && department_ids.length > 0) {
            const departments = await Department.findAll({
                where: { id: department_ids },
                transaction
            });

            if (departments.length !== department_ids.length) {
                await transaction.rollback();
                return res.status(400).json({ error: 'One or more department_ids are invalid' });
            }
        }

        // Validate primary_department_id if provided
        if (primary_department_id) {
            // Check if primary_department_id is in the department_ids array
            if (!department_ids.includes(primary_department_id)) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Primary department must be one of the assigned departments' });
            }
        }

        // Check for existing email (case-insensitive)
        const existingStaff = await Staff.findOne({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('email')),
                trimmedEmail
            ),
            transaction
        });

        if (existingStaff) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Email already exists' });
        }
        // Handle profile picture
        let profile_pic = null;
        if (req.file) {
            profile_pic = `/uploads/profile_pic/${req.file.filename}`;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Encrypt sensitive data
        const encryptedEmail = encrypt(trimmedEmail);
        const encryptedPhoneNumber = encrypt(phoneNumber);
        const encryptedFirstName = encrypt(firstName);
        const encryptedLastName = encrypt(lastName);

        // Generate staffID
        const institutionInitials = getInstitutionInitials(institution.name);
        const randomIntegers = Math.floor(1000 + Math.random() * 9000);
        const staffID = `${institutionInitials}${randomIntegers}`;

        // Create staff record within transaction
        const staff = await Staff.create({
            firstName: encryptedFirstName,
            middleName: middleName ? encrypt(middleName) : null,
            lastName: encryptedLastName,
            email: encryptedEmail,
            password: hashedPassword,
            institution_id: institution_id,
            admin_id: admin_id,
            role_id: role_id,
            staffID,
            phone_number: encryptedPhoneNumber,
            profile_pic,
            is_incharge: is_incharge || false
        }, { transaction });
        const { qr, qrImage } = await generateStaffQrCode(
            staff.id,
            staff.institution_id,
            transaction
        );

        // Create department assignments if department_ids provided
        if (department_ids && department_ids.length > 0) {
            const assignments = department_ids.map(deptId => ({
                staff_id: staff.id,
                department_id: deptId,
                primary_department: deptId === primary_department_id // Set true only for primary department
            }));

            await StaffDepartment.bulkCreate(assignments, { transaction });

            // Set the staff's primary department (department_id in Staff table)
            const primaryDept = primary_department_id || department_ids[0];
            await Staff.update({ department_id: primaryDept }, { where: { id: staff.id }, transaction });
        }

        // Handle legacy department_id if provided (single department)
        if (department_id) {
            // Check if this department_id is already in department_ids array
            if (!department_ids.includes(department_id)) {
                const isPrimary = department_id === primary_department_id;
                await StaffDepartment.create({
                    staff_id: staff.id,
                    department_id: department_id,
                    primary_department: isPrimary
                }, { transaction });
                await Staff.update({ department_id: primary_department_id || department_id }, { where: { id: staff.id }, transaction });
            }
        }

        // Commit the transaction
        await transaction.commit();

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Staff registered successfully',
            data: {
                id: staff.id,
                staffID,
                firstName: firstName,
                lastName: lastName,
                email: trimmedEmail,
                departments: department_ids
            }
        });

    } catch (err) {
        // Rollback transaction in case of error
        await transaction.rollback();

        console.error('Staff registration error:', err);

        // Handle specific error types
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                error: 'Email or staff ID already exists'
            });
        } else if (err.name === 'SequelizeValidationError') {
            const validationErrors = err.errors.map(error => ({
                field: error.path,
                message: error.message
            }));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        } else if (err.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid reference to related entity'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            error: 'Internal server error during staff registration',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    }
};





exports.registerAdmin = async (req, res) => {
    const { username, email, password, institution_id } = req.body;

    if (!username || !email || !password || !institution_id) {
        return res.status(400).json({ error: 'Please make sure that all required fields are entered' });
    }

    const trimEmail = String(email).toLowerCase().trim()

    try {
        const institution = await Institution.findByPk(institution_id);
        if (!institution) return res.status(400).json({ error: 'Invalid institution_id' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await Admin.create({ username, email: trimEmail, password_hash: hashedPassword, institution_id });

        // Sending email to the new admin
        // await sendEmail(admin.email, 'Welcome to the Team!', 'admin-logins', {
        //     username: admin.username,
        //     email: admin.email,
        //     password: password, // Initial password
        //     institutionName: institution.name,
        // });

        res.status(201).json({ success: 'Admin created successfully', user: admin });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ error: 'Username or email already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
};

exports.getAllStaffByInstitution = async (req, res) => {
    const { institution_id, department_id } = req.query;

    try {
        // Validate institution existence
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: "Institution not found" });
        }

        // Build where clause
        const whereClause = { institution_id };

        // Add department_id to where clause only if provided
        if (department_id) {
            whereClause.department_id = department_id;
        }

        // Fetch all staff under the institution (and department if provided)
        const staffList = await Staff.findAll({
            where: whereClause,
            include: [
                { model: Department, as: "department", attributes: ["id", "name"] },
                { model: Role, as: "role", attributes: ["id", "name"] },
                { model: Attendance, as: "attendance" },
                { model: RotationStaff, as: "rotation" },
                { model: StaffDepartment, as: 'staff_departments' },
            ],
        });

        // Decrypt sensitive information for each staff member
        const decryptedStaffList = staffList.map(staff => {
            const decryptedStaff = staff.toJSON();

            // Decrypt first name
            if (decryptedStaff.firstName) {
                try {
                    decryptedStaff.firstName = decrypt(decryptedStaff.firstName);
                } catch (error) {
                    console.error(`Error decrypting firstName for staff ${staff.id}:`, error);
                    decryptedStaff.firstName = "Decryption Error";
                }
            }

            // Decrypt middle name
            if (decryptedStaff.middleName) {
                try {
                    decryptedStaff.middleName = decrypt(decryptedStaff.middleName);
                } catch (error) {
                    console.error(`Error decrypting middleName for staff ${staff.id}:`, error);
                    decryptedStaff.middleName = "Decryption Error";
                }
            }

            // Decrypt last name
            if (decryptedStaff.lastName) {
                try {
                    decryptedStaff.lastName = decrypt(decryptedStaff.lastName);
                } catch (error) {
                    console.error(`Error decrypting lastName for staff ${staff.id}:`, error);
                    decryptedStaff.lastName = "Decryption Error";
                }
            }

            // Decrypt email
            if (decryptedStaff.email) {
                try {
                    decryptedStaff.email = decrypt(decryptedStaff.email);
                } catch (error) {
                    console.error(`Error decrypting email for staff ${staff.id}:`, error);
                    decryptedStaff.email = "Decryption Error";
                }
            }

            // Decrypt phone number
            if (decryptedStaff.phone_number) {
                try {
                    decryptedStaff.phone_number = decrypt(decryptedStaff.phone_number);
                } catch (error) {
                    console.error(`Error decrypting phone_number for staff ${staff.id}:`, error);
                    decryptedStaff.phone_number = "Decryption Error";
                }
            }

            return decryptedStaff;
        });

        res.status(200).json({
            success: true,
            staff: decryptedStaffList,
            count: decryptedStaffList.length,
            filters: {
                institution_id,
                department_id: department_id || 'all departments'
            }
        });
    } catch (error) {
        console.error("Error fetching staff:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getAllStaffsByRoles = async (req, res) => {
    const { institution_id, role_id } = req.query;

    try {
        if (!institution_id) {
            return res.status(400).json({
                error: "institution_id is required"
            });
        }

        const whereClause = { institution_id };

        if (role_id) {
            whereClause.role_id = role_id;
        }

        const staffList = await Staff.findAll({
            where: whereClause,
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["id", "name"]
                },
                {
                    model: Department,
                    as: "department",
                    attributes: ["id", "name"]
                }
            ]
        });

        const decryptedStaffList = staffList.map(staff => {
            const staffData = staff.toJSON();

            ["firstName", "middleName", "lastName", "email", "phone_number"]
                .forEach(field => {
                    if (staffData[field]) {
                        try {
                            staffData[field] = decrypt(staffData[field]);
                        } catch (err) {
                            staffData[field] = "Decryption Error";
                        }
                    }
                });

            return staffData;
        });

        return res.status(200).json({
            success: true,
            count: decryptedStaffList.length,
            staff: decryptedStaffList
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: error.message
        });
    }
};

exports.getStaffByInstitutionAndId = async (req, res) => {
    const { institution_id, staff_id } = req.query;

    try {
        // Validate institution
        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ error: "Institution not found" });
        }

        // Fetch specific staff member
        const staff = await Staff.findOne({
            where: { id: staff_id, institution_id },
            include: [
                { model: Department, as: "department", attributes: ["id", "name"] },
                { model: Role, as: "role", attributes: ["id", "name"] },
                { model: Attendance, as: "attendance" },
                { model: RotationStaff, as: "rotation" },
                {
                    model: LeaveRequest,
                    as: 'leaveRequest'
                },
                {
                    model: Appointment,
                    as: 'appointments'
                },
                { model: StaffDepartment, as: 'staff_departments' }
            ],
        });

        if (!staff) {
            return res.status(404).json({ error: "Staff member not found" });
        }

        // Decrypt sensitive information for the staff member
        const decryptedStaff = staff.toJSON();

        // Decrypt first name
        if (decryptedStaff.firstName) {
            try {
                decryptedStaff.firstName = decrypt(decryptedStaff.firstName);
            } catch (error) {
                console.error(`Error decrypting firstName for staff ${staff_id}:`, error);
                decryptedStaff.firstName = "Decryption Error";
            }
        }

        // Decrypt middle name
        if (decryptedStaff.middleName) {
            try {
                decryptedStaff.middleName = decrypt(decryptedStaff.middleName);
            } catch (error) {
                console.error(`Error decrypting middleName for staff ${staff_id}:`, error);
                decryptedStaff.middleName = "Decryption Error";
            }
        }

        // Decrypt last name
        if (decryptedStaff.lastName) {
            try {
                decryptedStaff.lastName = decrypt(decryptedStaff.lastName);
            } catch (error) {
                console.error(`Error decrypting lastName for staff ${staff_id}:`, error);
                decryptedStaff.lastName = "Decryption Error";
            }
        }

        // Decrypt email
        if (decryptedStaff.email) {
            try {
                decryptedStaff.email = decrypt(decryptedStaff.email);
            } catch (error) {
                console.error(`Error decrypting email for staff ${staff_id}:`, error);
                decryptedStaff.email = "Decryption Error";
            }
        }

        // Decrypt phone number
        if (decryptedStaff.phone_number) {
            try {
                decryptedStaff.phone_number = decrypt(decryptedStaff.phone_number);
            } catch (error) {
                console.error(`Error decrypting phone_number for staff ${staff_id}:`, error);
                decryptedStaff.phone_number = "Decryption Error";
            }
        }

        res.status(200).json({ success: true, staff: decryptedStaff });
    } catch (error) {
        console.error("Error fetching staff details:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


// update primary department or assign primary department which is the department_id of the staff
exports.assignedPrimaryDepartment = async (req, res) => {
    const { staff_id, department_id } = req.body;

    try {
        // Validate input
        if (!staff_id || !department_id) {
            return res.status(400).json({ error: "staff_id and department_id are required" });
        }

        // ✅ Check if staff exists in StaffDepartment (mapping table)
        const staffDept = await StaffDepartment.findOne({ where: { staff_id } });
        if (!staffDept) {
            return res.status(404).json({ error: "Staff member not found in any department" });
        }

        // ✅ Validate department existence
        const department = await Department.findByPk(department_id);
        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        // ✅ Remove any existing primary department assignment for this staff
        await StaffDepartment.update(
            { primary_department: false },
            { where: { staff_id } }
        );

        // ✅ Set the selected department as the new primary department
        const [updated] = await StaffDepartment.update(
            { primary_department: true },
            { where: { staff_id, department_id } }
        );

        if (updated === 0) {
            return res.status(404).json({
                error: "This staff is not linked to the selected department."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Primary department updated successfully"
        });
    } catch (error) {
        console.error("Error updating primary department:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};




exports.deleteStaff = async (req, res) => {
    const { staff_id, institution_id } = req.query; // Assuming the staff ID is passed in the URL

    try {
        // Find the staff member by their ID
        const staff = await Staff.findOne({ where: { id: staff_id } });

        // If the staff member is not found, return an error
        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const insitution = Institution.findByPk(institution_id)
        if (!insitution) return res.status(404).json({ error: 'Insitution id not found' })

        await sequelize.transaction(async (t) => {
            // Remove permissions linked to the staff
            await StaffDepartment.destroy({
                where: { staff_id: staff_id },
                transaction: t
            });

            // Now you can safely delete or update the staff record
            await Staff.destroy({
                where: { id: staff_id },
                transaction: t
            });

        });

        // Return a success response
        res.status(200).json({ message: 'Staff member and related records deleted successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred while trying to delete the staff member' });
    }
};



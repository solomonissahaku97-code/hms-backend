const {  Admin, Diagnosis, Department, Staff, Patient, PatientDiagnosis, LabResult,AccessControl,VitalSignsRecord ,RotationStaff,Permission} = require('../../models');
const Bed = require('../../models/beds');
const Institution = require('../../models/institution');
const InstitutionSubscription = require('../../models/InstitutionSubscription');
const Role = require('../../models/role');
const SmsSubscriptions = require('../../models/SmsSubscriptions');
const Subscription = require('../../models/subscription');
const sequelize = require('../../config/database'); // Ensure this points to your database configuration
const Referrals = require('../../models/Refferals');
const validateInstitution = require('../../validators/validateInstitution')
const handleReferralDiscount = require('../../helpers/handleReferDiscount');
const InstitutionSubAccounts = require('../../models/InsitutionSubAccounts');

exports.createInstitution = async (req, res) => {
    const { name, address, contact, description, google_map_link, fax, region, email, serial_code, website, country, referralCode } = req.body;


    try {
        let logo_url = null;
        if (req.file) {
            logo_url = `/uploads/logos/${req.file.filename}`;
        }
        const generated_serial_code = serial_code || Math.floor(10000000 + Math.random() * 90000000).toString();

        // Validate referral code if provided
        if (referralCode) {
            const referrer = await Institution.findOne({ where: { referral_code: referralCode } });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code provided' });
            }
        }

        const transaction = await sequelize.transaction();

        const institution = await Institution.create({
            name, address, contact, description, google_map_link, fax, logo_url, serial_code: generated_serial_code,
            region, email, website, country, referral_code: generated_serial_code
        }, { transaction });

        await transaction.commit();

        res.status(201).json({ message: 'Institution and default subscription created successfully', institution });
    } catch (error) {
        console.error('Error creating institution:', error);
        res.status(500).json({ error: 'An error occurred while creating the institution', details: error.message });
    }
};



// Update an existing institution by ID
exports.updateInstitution = async (req, res) => {
    const { id } = req.params;
    const { name, address, contact, description, google_map_link, fax } = req.body;

    try {
        const institution = await Institution.findByPk(id);

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        // Check if a file was uploaded and update the logo URL
        if (req.file) {
            institution.logo_url = `/uploads/logos/${req.file.filename}`;
        }

        // Update institution details
        institution.name = name || institution.name;
        institution.address = address || institution.address;
        institution.contact = contact || institution.contact;
        institution.description = description || institution.description;
        institution.google_map_link = google_map_link || institution.google_map_link;
        institution.fax = fax || institution.fax;

        await institution.save();

        res.status(200).json({ message: 'Institution updated successfully', institution });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the institution' });
    }
};


// Get all institutions 
exports.getAllInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.findAll();
        res.status(200).json(institutions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching institutions' });
    }
};

// Get a single institution by ID
exports.getInstitutionById = async (req, res) => {
    const { id } = req.params;

    try {
        const institution = await Institution.findAll({
            where: { id },
            include:[
                {
                    model:InstitutionSubAccounts,
                    as:'institution_accounts'
                }
            ]
         
        });

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        res.status(200).json(institution);
    } catch (error) {
        console.error('Error fetching institution:', error);
        res.status(500).json({ error: 'An error occurred while fetching the institution' });
    }
};


exports.getAdminDetails = async (req, res) => {
    const { adminId } = req.params;

    try {
        const admin = await Admin.findByPk(adminId, {
            include: [{
                model: Institution,
                as: 'institution',
            }],
        });

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const institutionId = admin.institution_id;

        const departments = await Department.findAll({
            where: { institution_id: institutionId },
            include: [
                {
                    model: Staff,
                    as: 'staff',
                    include: [
                        {
                            model: RotationStaff,
                            as: 'rotations',
                            attributes: ['day', 'shift']
                        },
                        
                    ]
                },
                {
                    model: Patient,
                    as: 'patients',
                    include: [
                        {
                            model: Diagnosis,
                            as: 'diagnosis',
                        },
                        {
                            model: LabResult,
                            as: 'labResults',
                            attributes:['id','patient_id']
                            
                        },
                        {
                            model: VitalSignsRecord,
                            as: 'vitalSignsRecords',
                            attributes: ['id', 'oxygen', 'temperature', 'bp', 'heart_rate', 'pulse', 'weight', 'height', 'rbs', 'created_at'],
                        },
                        {
                            model: Staff,
                            as: 'staff',
                          
                        },

                       
                    ],
                },
                {
                    model: AccessControl,
                    as: 'AccessControls',
                },
                {
                    model:Bed,
                    as:'bed'
                }
            ],
        });

        const staffs = await Staff.findAll({
            where: { institution_id: institutionId },
            include:[
                {
                    model: Department,
                    as: 'department'
                },
                {
                    model: RotationStaff,
                    as: 'rotations',
                    attributes: ['day', 'shift']
                },
                {
                    model: Role,
                    as: 'role',
                    
                },
            ]
        });

        // Fetch permissions manually
        for (const staff of staffs) {
            const permissionIds = staff.permissions;
            if (permissionIds && permissionIds.length > 0) {
                const permissions = await Permission.findAll({
                    where: {
                        id: permissionIds,
                    },
                });
                staff.dataValues.permissions = permissions.map(permission => ({
                    id: permission.id,
                    name: permission.name
                }));
            } else {
                staff.dataValues.permissions = [];
            }
        }
        

        const patients = await Patient.findAll({
            where: { institution_id: institutionId },
            include: [
                {
                    model: Diagnosis,
                    as: 'diagnosis',
                },
                {
                    model: LabResult,
                    as: 'labResults',
                },
                {
                    model: VitalSignsRecord,
                    as: 'vitalSignsRecords',
                    attributes: ['id', 'oxygen', 'temperature', 'bp', 'heart_rate', 'pulse', 'weight', 'height', 'rbs', 'created_at'],
                },
            ],
        });

        return res.status(200).json({
            admin,
            institution: admin.institution,
            staffs,
            patients,
            departments,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching details' });
    }
};




  








const {  Admin, Diagnosis, Department, Staff, Patient, PatientDiagnosis, LabResult,AccessControl,VitalSignsRecord ,RotationStaff,Permission} = require('../../models');
const Bed = require('../../models/beds');
const Institution = require('../../models/institution');
const InstitutionSubscription = require('../../models/InstitutionSubscription');
const InstitutionRating = require('../../models/InstitutionRating');
const Role = require('../../models/role');
const SmsSubscriptions = require('../../models/SmsSubscriptions');
const Subscription = require('../../models/subscription');
const sequelize = require('../../config/database'); // Ensure this points to your database configuration
const Referrals = require('../../models/Refferals');
const validateInstitution = require('../../validators/validateInstitution')
const handleReferralDiscount = require('../../helpers/handleReferDiscount');
const InstitutionSubAccounts = require('../../models/InsitutionSubAccounts');

exports.createInstitution = async (req, res) => {
    const { name, address, contact, description, google_map_link, fax, region, email, serial_code, website, country, referralCode, workflow_mode } = req.body;


    try {
        let logo_url = null;
        if (req.body.logo) {
            logo_url = req.body.logo;
        }
        const generated_serial_code = serial_code || Math.floor(10000000 + Math.random() * 90000000).toString();

        // Validate referral code if provided
        if (referralCode) {
            const referrer = await Institution.findOne({ where: { serial_code: referralCode } });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code provided' });
            }
        }

        const transaction = await sequelize.transaction();

        const institution = await Institution.create({
            name, address, contact, description, google_map_link, fax, logo_url, serial_code: generated_serial_code,
            region, email, website, country, workflow_mode: workflow_mode || 'full'
        }, { transaction });

        const freeTrial = await Subscription.findOne({ where: { name: 'Free Trial' } });
        if (!freeTrial) {
            await transaction.rollback();
            return res.status(500).json({ error: 'Free Trial subscription plan not found. Please contact support.' });
        }

        await InstitutionSubscription.create({
            institutionId: institution.id,
            subscriptionId: freeTrial.id,
            startDate: new Date(),
        }, { transaction });

        // Auto-create default departments
        const defaultDepartments = [
            {
                name: 'Records Department',
                institution_id: institution.id,
                description: 'Manages patient records, medical history, and document filing',
                departmentType: 'Records',
            },
            {
                name: 'Accounts Department',
                institution_id: institution.id,
                description: 'Handles billing, payments, invoicing, and financial operations',
                departmentType: 'Accounts',
            },
        ];

        const createdDepartments = await Department.bulkCreate(defaultDepartments, { transaction, individualHooks: true });

        await transaction.commit();

        res.status(201).json({
            message: 'Institution, default subscription, and departments created successfully',
            institution,
            departments: createdDepartments,
        });
    } catch (error) {
        console.error('Error creating institution:', error);
        res.status(500).json({ error: 'An error occurred while creating the institution', details: error.message });
    }
};



// Update an existing institution by ID
exports.updateInstitution = async (req, res) => {
    const { id } = req.params;
    const { name, address, contact, description, google_map_link, fax, workflow_mode } = req.body;

    try {
        const institution = await Institution.findByPk(id, { paranoid: false });

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        // Handle status toggle via deletedAt (soft delete / restore)
        if ('deletedAt' in req.body) {
            if (req.body.deletedAt === null) {
                // Restore the institution
                await institution.restore();
                // Re-fetch after restore to get fresh data
                const restored = await Institution.findByPk(id);
                return res.status(200).json({ message: 'Institution activated successfully', institution: restored });
            } else if (req.body.deletedAt !== undefined) {
                // Soft-delete the institution
                await institution.destroy();
                // Re-fetch to include deletedAt in response
                const deleted = await Institution.findByPk(id, { paranoid: false });
                return res.status(200).json({ message: 'Institution deactivated successfully', institution: deleted });
            }
        }

        // Check if a file was uploaded and update the logo URL
        if (req.body.logo) {
            institution.logo_url = req.body.logo;
        }

        // Update institution details
        institution.name = name || institution.name;
        institution.address = address || institution.address;
        institution.contact = contact || institution.contact;
        institution.description = description || institution.description;
        institution.google_map_link = google_map_link || institution.google_map_link;
        institution.fax = fax || institution.fax;
        if (workflow_mode) {
            institution.workflow_mode = workflow_mode;
        }

        await institution.save();

        res.status(200).json({ message: 'Institution updated successfully', institution });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the institution' });
    }
};


// Delete an institution (soft delete)
exports.deleteInstitution = async (req, res) => {
    const { id } = req.params;

    try {
        const institution = await Institution.findByPk(id);

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        await Promise.all([
            Admin.destroy({ where: { institution_id: id } }),
            Staff.destroy({ where: { institution_id: id } }),
            Patient.destroy({ where: { institution_id: id }, force: true }),
            Department.destroy({ where: { institution_id: id } }),
            InstitutionSubAccounts.destroy({ where: { institution_id: id } }),
        ]);

        await institution.destroy();

        res.status(200).json({ message: 'Institution deleted successfully' });
    } catch (error) {
        console.error('Error deleting institution:', error);
        res.status(500).json({ error: 'An error occurred while deleting the institution' });
    }
};

// Get all institutions 
exports.getAllInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.findAll({ paranoid: false });
        res.status(200).json(institutions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching institutions' });
    }
};

// Get a single institution by ID (public profile)
exports.getInstitutionById = async (req, res) => {
    const { id } = req.params;

    try {
        const institution = await Institution.findByPk(id);

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        const publicProfile = {
            id: institution.id,
            name: institution.name,
            short_description: institution.short_description,
            description: institution.description,
            about: institution.about,
            mission: institution.mission,
            vision: institution.vision,
            core_values: institution.core_values,
            website: institution.website,
            opening_hours: institution.opening_hours,
            emergency_contact: institution.emergency_contact,
            services_offered: institution.services_offered,
            facilities_available: institution.facilities_available,
            social_media_links: institution.social_media_links,
            gallery_images: institution.gallery_images,
            banner_image_url: institution.banner_image_url,
            logo_url: institution.logo_url,
            address: institution.address,
            contact: institution.contact,
            email: institution.email,
            country: institution.country,
            region: institution.region,
            fax: institution.fax,
            established_date: institution.established_date,
            google_map_link: institution.google_map_link,
            serial_code: institution.serial_code,
            workflow_mode: institution.workflow_mode,
        };

        res.status(200).json(publicProfile);
    } catch (error) {
        console.error('Error fetching institution:', error);
        res.status(500).json({ error: 'An error occurred while fetching the institution' });
    }
};

// Get institution reviews
exports.getInstitutionReviews = async (req, res) => {
    const { id } = req.params;

    try {
        const institution = await Institution.findByPk(id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        const reviews = await InstitutionRating.findAll({
            where: { institution_id: id },
            order: [['created_at', 'DESC']],
        });

        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        res.status(200).json({
            success: true,
            data: {
                reviews,
                averageRating: Math.round(avgRating * 10) / 10,
                totalReviews: reviews.length,
            }
        });
    } catch (error) {
        console.error('Error fetching institution reviews:', error);
        res.status(500).json({ error: 'An error occurred while fetching reviews' });
    }
};

// Create institution review
exports.createInstitutionReview = async (req, res) => {
    const { id } = req.params;
    const { username, email, rating, review } = req.body;

    try {
        const institution = await Institution.findByPk(id);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const existingReview = await InstitutionRating.findOne({
            where: { institution_id: id, email },
        });

        if (existingReview) {
            return res.status(400).json({ error: 'You have already reviewed this institution. Each email can only submit one review per institution.' });
        }

        const newReview = await InstitutionRating.create({
            institution_id: id,
            username: username || 'Anonymous',
            email,
            rating,
            review: review || '',
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: newReview,
        });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ error: 'An error occurred while submitting review' });
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

// GET ADMINS FROM VARIOUS INSTITUTION

// GET ALL ADMINS FOR A PARTICULAR INSTITUTION
exports.getAllInstitutionAdmins = async (req, res) => {
    const { institution_id } = req.params;

    try {
        const admins = await Admin.findAll({
            where: {
                institution_id
            },
            include: [
                {
                    model: Institution,
                    as: 'institution'
                }
            ],
        });

        return res.status(200).json({
            success: true,
            count: admins.length,
            admins
        });
    } catch (error) {
        console.error('Error fetching institution admins:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching institution admins.',
            error: error.message
        });
    }
};

// Get current institution public profile
exports.getInstitutionProfile = async (req, res) => {
    try {
        const institutionId = req.admin?.institution_id || req.user?.institution_id;
        if (!institutionId) {
            return res.status(400).json({ success: false, error: 'Institution not found for current user' });
        }

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ success: false, error: 'Institution not found' });
        }

        const profileFields = [
            'id', 'name', 'short_description', 'about', 'mission', 'vision', 'core_values',
            'website', 'opening_hours', 'emergency_contact', 'services_offered',
            'facilities_available', 'social_media_links', 'gallery_images', 'banner_image_url',
            'logo_url', 'address', 'contact', 'email', 'country', 'region', 'fax', 'workflow_mode'
        ];

        const profile = {};
        profileFields.forEach(field => {
            profile[field] = institution[field] || null;
        });

        return res.status(200).json({ success: true, data: profile });
    } catch (error) {
        console.error('Error fetching institution profile:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while fetching institution profile',
            details: error.message
        });
    }
};

// Update current institution public profile
exports.updateInstitutionProfile = async (req, res) => {
    try {
        const institutionId = req.admin?.institution_id || req.user?.institution_id;
        if (!institutionId) {
            return res.status(400).json({ success: false, error: 'Institution not found for current user' });
        }

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ success: false, error: 'Institution not found' });
        }

        const allowedFields = [
            'short_description', 'about', 'mission', 'vision', 'core_values',
            'website', 'opening_hours', 'emergency_contact', 'services_offered',
            'facilities_available', 'social_media_links', 'gallery_images', 'banner_image_url',
            'name', 'address', 'contact', 'email', 'fax'
        ];

        const jsonFields = ['opening_hours', 'social_media_links', 'gallery_images'];

        let updated = false;
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                let value = req.body[field];
                if (jsonFields.includes(field) && typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        value = null;
                    }
                }
                institution[field] = value;
                updated = true;
            }
        });

        if (req.body.workflow_mode && ['full', 'lab_only', 'opd_only', 'records_lab'].includes(req.body.workflow_mode)) {
            institution.workflow_mode = req.body.workflow_mode;
            updated = true;
        }

        if (req.body.banner_image) {
            institution.banner_image_url = req.body.banner_image;
            updated = true;
        }

        if (updated) {
            await institution.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Institution profile updated successfully',
            data: institution
        });
    } catch (error) {
        console.log('Error updating institution profile:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while updating institution profile',
            details: error.message
        });
    }
};

// Upload gallery image
exports.uploadGalleryImage = async (req, res) => {
    try {
        const institutionId = req.admin?.institution_id || req.user?.institution_id;
        if (!institutionId) {
            return res.status(400).json({ success: false, error: 'Institution not found for current user' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ success: false, error: 'Institution not found' });
        }

        // storage path from Supabase middleware (sftpUpload)
        const imageUrl = req.body.gallery_image;
        const gallery = Array.isArray(institution.gallery_images) ? [...institution.gallery_images] : [];

        if (gallery.length >= 8) {
            return res.status(400).json({ success: false, error: 'Maximum of 8 gallery images allowed' });
        }

        gallery.push(imageUrl);
        institution.gallery_images = gallery;
        await institution.save();

        return res.status(200).json({
            success: true,
            message: 'Gallery image uploaded successfully',
            data: { imageUrl, gallery_images: gallery }
        });
    } catch (error) {
        console.error('Error uploading gallery image:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while uploading gallery image',
            details: error.message
        });
    }
};

// Delete gallery image by index
exports.deleteGalleryImage = async (req, res) => {
    try {
        const institutionId = req.admin?.institution_id || req.user?.institution_id;
        const { index } = req.params;

        if (!institutionId) {
            return res.status(400).json({ success: false, error: 'Institution not found for current user' });
        }

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ success: false, error: 'Institution not found' });
        }

        const gallery = Array.isArray(institution.gallery_images) ? [...institution.gallery_images] : [];
        const imageIndex = parseInt(index, 10);

        if (isNaN(imageIndex) || imageIndex < 0 || imageIndex >= gallery.length) {
            return res.status(400).json({ success: false, error: 'Invalid image index' });
        }

        gallery.splice(imageIndex, 1);
        institution.gallery_images = gallery;
        await institution.save();

        return res.status(200).json({
            success: true,
            message: 'Gallery image deleted successfully',
            data: { gallery_images: gallery }
        });
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while deleting gallery image',
            details: error.message
        });
    }
};



   







const db = require('../models');
const { defaultRoles } = require('./createRoles');

// Define which permissions each role gets by default
const rolePermissionMap = {
  'Doctor': ['request_lab', 'manage_lab_results', 'view_lab_results', 'request_pharmacy', 'manage_prescriptions', 'view_pharmacy', 'request_procedure', 'view_procedures', 'view_patient_details', 'edit_patient_details', 'view_patient_history', 'chat_departments', 'manage_diagnosis', 'manage_vitals', 'view_anc', 'view_deliveries', 'view_appointments', 'access_records', 'access_opd', 'access_consultation', 'view_reports'],
  'Nurse': ['view_patient_details', 'manage_vitals', 'view_patient_history', 'chat_departments', 'view_anc', 'manage_anc', 'view_deliveries', 'view_appointments', 'access_records', 'access_opd', 'access_maternity', 'view_partograph', 'manage_partograph'],
  'MidWife': ['view_patient_details', 'manage_vitals', 'view_patient_history', 'chat_departments', 'view_anc', 'manage_anc', 'view_deliveries', 'manage_deliveries', 'view_appointments', 'access_records', 'access_opd', 'access_maternity', 'view_partograph', 'manage_partograph'],
  'Lab Technician': ['request_lab', 'manage_lab_results', 'view_lab_results', 'approve_lab_results', 'view_patient_details', 'chat_departments', 'access_lab'],
  'Pharmacist': ['request_pharmacy', 'manage_prescriptions', 'dispense_pharmacy', 'view_pharmacy', 'view_patient_details', 'chat_departments', 'access_pharmacy'],
  'Pharmacy Technician': ['view_pharmacy', 'dispense_pharmacy', 'view_patient_details', 'chat_departments', 'access_pharmacy'],
  'Radiologist': ['view_patient_details', 'view_patient_history', 'chat_departments', 'access_radiology'],
  'Surgeon': ['request_procedure', 'manage_procedures', 'view_procedures', 'view_patient_details', 'edit_patient_details', 'view_patient_history', 'chat_departments', 'manage_diagnosis', 'access_records', 'access_opd'],
  'Anesthesiologist': ['view_patient_details', 'view_patient_history', 'chat_departments', 'view_procedures', 'access_records', 'access_opd'],
  'Physician Assistant': ['request_lab', 'view_lab_results', 'request_pharmacy', 'view_pharmacy', 'request_procedure', 'view_procedures', 'view_patient_details', 'edit_patient_details', 'view_patient_history', 'chat_departments', 'manage_diagnosis', 'manage_vitals', 'view_anc', 'view_deliveries', 'view_appointments', 'access_records', 'access_opd', 'access_consultation'],
  'Medical Receptionist': ['view_appointments', 'manage_appointments', 'view_patient_details', 'chat_departments', 'access_opd'],
  'Medical Secretary': ['view_appointments', 'manage_appointments', 'view_patient_details', 'chat_departments', 'access_records'],
  'Medical Records Clerk': ['access_records', 'view_patient_details', 'view_patient_history', 'chat_departments'],
  'Claims Officer': ['view_billing', 'manage_billing', 'approve_claims', 'view_claims', 'view_patient_details', 'chat_departments'],
  'Health Information Manager': ['access_records', 'view_patient_details', 'view_patient_history', 'view_reports', 'manage_settings', 'chat_departments'],
  'Default': ['view_patient_details', 'chat_departments']
};

const seedRolePermissions = async () => {
    try {
        const Permission = db.Permission;
        const Role = db.Role;
        const RolePermission = db.RolePermission;

        if (!Permission || !Role || !RolePermission) {
            console.log('Required models not found, skipping role permissions seeding...');
            return;
        }

        // Get all roles
        const roles = await Role.findAll();
        
        for (const role of roles) {
            const permissionNames = rolePermissionMap[role.name] || rolePermissionMap['Default'];
            
            for (const permName of permissionNames) {
                const permission = await Permission.findOne({ where: { name: permName } });
                
                if (permission) {
                    await RolePermission.findOrCreate({
                        where: {
                            role_id: role.id,
                            permission_id: permission.id
                        },
                        defaults: {
                            role_id: role.id,
                            permission_id: permission.id
                        }
                    });
                }
            }
            
            console.log(`Role permissions seeded for: ${role.name}`);
        }

        console.log('Role permissions seeding completed.');
    } catch (error) {
        console.error('Error seeding role permissions:', error);
    }
};

module.exports = seedRolePermissions;

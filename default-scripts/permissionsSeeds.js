// initializePermissions.js
const db = require('../models');
const { staff_permissions } = require('../permissions/staffPermissions');

const initializePermissions = async () => {
    try {
        const Permission = db.Permission;
        
        if (!Permission) {
            console.log('Permission model not found, skipping...');
            return;
        }
        
        for (const permission of staff_permissions) {
            const [perm, created] = await Permission.findOrCreate({
                where: { name: permission },
                defaults: { name: permission }
            });

            if (created) {
                console.log(`Permission '${permission}' added to the database.`);
            }
        }
        console.log('Permissions initialization completed.');
    } catch (error) {
        console.error('Error initializing permissions:', error);
    }
};

module.exports = initializePermissions;

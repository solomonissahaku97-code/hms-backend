// initializePermissions.js
const db = require('../models');
const { permissions } = require('../permissions/permissions');

const initializePermissions = async () => {
    try {
        const Permission = db.Permission;
        
        if (!Permission) {
            console.log('Permission model not found, skipping...');
            return;
        }
        
        for (const permission of permissions) {
            const [perm, created] = await Permission.findOrCreate({
                where: { name: permission.name },
                defaults: { 
                    name: permission.name,
                    description: permission.description
                }
            });

            if (created) {
                console.log(`Permission '${permission.name}' added to the database.`);
            }
        }
        console.log('Permissions initialization completed.');
    } catch (error) {
        console.error('Error initializing permissions:', error);
    }
};

module.exports = initializePermissions;

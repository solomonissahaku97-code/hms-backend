const checkPermission = (requiredPermissionName) => {
    return async (req, res, next) => {
        try {
            const permissions = req.permissions || [];
            
            // Super admin and admin have all permissions (marked by '*')
            if (permissions.includes('*')) {
                return next();
            }

            if (!permissions.includes(requiredPermissionName)) {
                return res.status(403).json({ 
                    error: 'Forbidden',
                    message: `You do not have permission to perform this action. Required: ${requiredPermissionName}` 
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'An error occurred while checking permissions' });
        }
    };
};

// Check if user has ANY of the listed permissions
const checkAnyPermission = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            const permissions = req.permissions || [];
            
            if (permissions.includes('*')) {
                return next();
            }

            const hasAny = requiredPermissions.some(p => permissions.includes(p));
            if (!hasAny) {
                return res.status(403).json({ 
                    error: 'Forbidden',
                    message: `You do not have permission to perform this action. Required one of: ${requiredPermissions.join(', ')}` 
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'An error occurred while checking permissions' });
        }
    };
};

// Check if user has ALL of the listed permissions
const checkAllPermissions = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            const permissions = req.permissions || [];
            
            if (permissions.includes('*')) {
                return next();
            }

            const hasAll = requiredPermissions.every(p => permissions.includes(p));
            if (!hasAll) {
                return res.status(403).json({ 
                    error: 'Forbidden',
                    message: `You do not have permission to perform this action. Required all of: ${requiredPermissions.join(', ')}` 
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'An error occurred while checking permissions' });
        }
    };
};

module.exports = {
    checkPermission,
    checkAnyPermission,
    checkAllPermissions
};

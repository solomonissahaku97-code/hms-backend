// utils/encryptionHelper.js
const { decrypt } = require('./encryption'); // Adjust path to your decrypt function

/**
 * Helper function to decrypt staff data
 * @param {Object} staffData - The staff data object to decrypt
 * @returns {Object} - Decrypted staff data
 */
const decryptStaffData = (staffData) => {
    const decryptedStaff = { ...staffData };
    
    const fieldsToDecrypt = [
        'firstName',
        'middleName', 
        'lastName',
        'email',
        'phone_number'
    ];
    
    fieldsToDecrypt.forEach(field => {
        if (decryptedStaff[field]) {
            try {
                decryptedStaff[field] = decrypt(decryptedStaff[field]);
            } catch (error) {
                console.error(`Error decrypting ${field} for staff:`, error);
                decryptedStaff[field] = "Decryption Error";
            }
        }
    });
    
    return decryptedStaff;
};

/**
 * Helper function to decrypt multiple staff records
 * @param {Array} staffList - Array of staff data objects
 * @returns {Array} - Array of decrypted staff data
 */
const decryptStaffList = (staffList) => {
    return staffList.map(staff => decryptStaffData(staff.toJSON ? staff.toJSON() : staff));
};

module.exports = {
    decryptStaffData,
    decryptStaffList
};
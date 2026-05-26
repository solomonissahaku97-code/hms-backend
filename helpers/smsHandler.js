const SmsSubscriptions = require("../models/SmsSubscriptions");

/**
 * Check if an institution has enough SMS before sending
 * @param {UUID} institutionId - The ID of the institution
 * @param {number} smsCount - Number of SMS to send
 * @returns {boolean} - Returns true if enough SMS, false otherwise
 */
const checkSmsBalance = async (institutionId, smsCount = 1) => {
    try {
        const subscription = await SmsSubscriptions.findOne({ where: { institution_id: institutionId } });

        if (!subscription) {
            throw new Error("Institution SMS subscription not found.");
        }

        if (subscription.total_sms - subscription.sms_used < smsCount) {
            return false; // Not enough SMS credits
        }

        return true; // Enough SMS credits
    } catch (error) {
        console.error("Error checking SMS balance:", error.message);
        throw new Error("Failed to check SMS balance.");
    }
};

/**
 * Deduct SMS after sending
 * @param {UUID} institutionId - The ID of the institution
 * @param {number} smsCount - Number of SMS to deduct
 */
const deductSms = async (institutionId, smsCount = 1) => {
    try {
        const subscription = await SmsSubscription.findOne({ where: { institution_id: institutionId } });

        if (!subscription) {
            throw new Error("Institution SMS subscription not found.");
        }

        if (subscription.total_sms - subscription.sms_used < smsCount) {
            throw new Error("Not enough SMS balance.");
        }

        // Deduct SMS
        subscription.sms_used += smsCount;
        await subscription.save();

        return true;
    } catch (error) {
        console.error("Error deducting SMS:", error.message);
        throw new Error("Failed to deduct SMS.");
    }
};

/**
 * Add SMS credits when an institution purchases more
 * @param {UUID} institutionId - The ID of the institution
 * @param {number} smsAmount - Number of SMS to add
 */
const addSmsCredits = async (institutionId, smsAmount) => {
    try {
        const subscription = await SmsSubscription.findOne({ where: { institution_id: institutionId } });

        if (!subscription) {
            throw new Error("Institution SMS subscription not found.");
        }

        // Add SMS credits
        subscription.total_sms += smsAmount;
        await subscription.save();

        return true;
    } catch (error) {
        console.error("Error adding SMS credits:", error.message);
        throw new Error("Failed to add SMS credits.");
    }
};

module.exports = { checkSmsBalance, deductSms, addSmsCredits };

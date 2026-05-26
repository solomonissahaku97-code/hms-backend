const DepartmentCreationBilling = require('../../models/DepartmentCreationBilling');
const PatientInstitutionCost = require('../../models/PatientInstitutionCost');
const initiatePayment = require('../../utils/paystack');

// PAYMENT TO BE MADE BY THE INSTITUTION FOR SOFTWARE CHARGES

const makePaymentForInstitutionCharges = async (req, res) => {
    const { institution_id } = req.body;

    if(!institution_id) return res.status(404).json({error:'Institution not found'})

    
    try {
        // Retrieve the total amount for department creation billing
        const departmentCreationBilling = await DepartmentCreationBilling.findOne({ where: { institution_id } });

        // Retrieve the total amount per patient for the institution
        const patientInstitutionCost = await PatientInstitutionCost.findOne({ where: { institution_id } });

        // Ensure both amounts are retrieved successfully
        if (!departmentCreationBilling || !patientInstitutionCost) {
            return res.status(404).json({ error: 'Billing information not found for the specified institution.' });
        }

        // Convert amounts to floats to ensure correct arithmetic addition
        const departmentAmount = parseFloat(departmentCreationBilling.amount_to_pay);
        const patientAmount = parseFloat(patientInstitutionCost.total_cost);

        // Calculate the total amount to be paid
        const totalAmount = departmentAmount + patientAmount;

        console.log('Total amount:', departmentAmount, patientAmount, totalAmount);

        

        // Meta data
        const metaData = {
            institution_id,
            institution_name: "Test Institution",
            email: "test@gmail.com"
        };

        // Initiate payment using the PayStack utility
        const paymentResponse = await initiatePayment.initiatePayment(totalAmount, 'test@gmail.com', metaData);

        // Handle payment response (e.g., save payment details, update status)
        if (paymentResponse.status === 'success') {
            const { authorization_url } = paymentResponse;

            return res.status(200).json({
                message: 'Payment initialized successfully',
                authorization_url,
            });
        } else {
            return res.status(400).json({ error: 'Payment initiation failed', details: paymentResponse });
        }

    } catch (error) {
        console.error('Error initiating payment:', error);
        return res.status(500).json({ error: 'An error occurred while processing the payment' });
    }
};



module.exports = {
    makePaymentForInstitutionCharges
};

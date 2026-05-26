const Department = require("../models/department");
const DepartmentCreationBilling = require("../models/DepartmentCreationBilling");
const InstitutionTotalCost = require("../models/InstitutionTotalCostPerMonth");
const PatientInstitutionCost = require("../models/PatientInstitutionCost");
const SoftwareChargesTable = require("../models/SoftwareCharge");

const FIXED_CHARGE_AMOUNT = 2;

// Handler to create a software charge for a patient
exports.createSoftwareCharge = async ({ institution_id, patient_id }) => {
    try {
        // Create a new software charge entry
        const softwareCharge = await SoftwareChargesTable.create({
            institution_id: institution_id,
            patient_id: patient_id,
            charge_amount: FIXED_CHARGE_AMOUNT,
            status: 'pending',
        });

        await createOrUpdateTotalCostPerPatient({institution_id,amount:FIXED_CHARGE_AMOUNT})

        console.log(`Software charge created successfully for patient ID: ${patient_id}`);
        return softwareCharge;
    } catch (error) {
        console.error('Error creating software charge:', error);
        throw new Error('Could not create software charge');
    }
};

// Handler to update the payment status for a software charge
exports.updateSoftwareChargeStatus = async (charge_id, status) => {
    try {
        const charge = await SoftwareChargesTable.findByPk(charge_id);

        if (!charge) {
            console.error('Software charge not found');
            throw new Error('Software charge not found');
        }

        // Update the status
        charge.status = status;
        await charge.save();

        console.log(`Software charge status updated to ${status}`);
        return charge;
    } catch (error) {
        console.error('Error updating software charge status:', error);
        throw new Error('Could not update software charge status');
    }
};


// HANDLE SOFTWARE DEPARTMENT CHARGES
exports.softwareDepartmentCHarges = async ({ institution_id, department_Id, amount_to_pay }) => {
    try {
        const departmentExists = await Department.findOne({ where: { id: department_Id, institution_id } });

        if (!departmentExists) {
            throw new Error(`Department with ID ${department_Id} does not exist in institution ${institution_id}`);
        }
        const department_charges = await DepartmentCreationBilling.create({
            institution_id,
            department_Id,
            amount_to_pay
        });

        // Save changes
       await  department_charges.save()

        // update total cost of the institution per month
        await createOrUpdateTotalCost({ institutionId: institution_id, amount: amount_to_pay })


    } catch (error) {
        console.log(error)
        throw new Error('could not create department billings')
    }
}






// create or update institution billing cost
const createOrUpdateTotalCost = async ({ institutionId, amount }) => {
    try {
        // Find the existing record for the institution
        let totalCost = await InstitutionTotalCost.findOne({ where: { institution_id: institutionId } });

        if (totalCost) {
            console.log(`Current amount_due: ${totalCost.amount_due}`);
            // Update the existing record
            totalCost.amount_due = parseFloat(totalCost.amount_due) + parseFloat(amount);

            await totalCost.save();
        } else {
            // Create a new record
            totalCost = await InstitutionTotalCost.create({
                institution_id: institutionId,
                amount_due: amount,
            });
        }

        return totalCost;
    } catch (error) {
        console.error('Error creating or updating total cost:', error);
        throw error;
    }
};


// handle create or update institution per patient bills
const createOrUpdateTotalCostPerPatient = async ({ institution_id, amount }) => {
    try {
        let totalCost = await PatientInstitutionCost.findOne({ where: { institution_id: institution_id } });
        if (totalCost) {
            console.log(`Current amount_due: ${totalCost.total_cost}`);
            totalCost.total_cost = parseFloat(totalCost.total_cost) + parseFloat(amount);
            await totalCost.save();

        } else {
            // Create a new record
            totalCost = await PatientInstitutionCost.create({
                institution_id: institution_id,
                total_cost: amount,
            });
        }
    } catch (error) {
        console.error('Error creating or updating total cost:', error);
        throw error;
    }
}







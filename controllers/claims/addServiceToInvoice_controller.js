const Invoice = require("../../models/Invoice");
const ServiceBill = require("../../models/serviceBill");

// 🔹 Add a service bill to an invoice
exports.addServiceToInvoice = async (patient_id, institution_id, service_bill_id, amount) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
        let invoice = await Invoice.findOne({
            where: { patient_id, institution_id, status: 'unpaid' },
            transaction
        });

        if (!invoice) {
            invoice = await Invoice.create({
                patient_id,
                institution_id,
                total_amount: amount,
                amount_paid: 0
            }, { transaction });
        } else {
            invoice.total_amount += amount;
            await invoice.save({ transaction });
        }

        await ServiceBill.update(
            { invoice_id: invoice.id },
            { where: { id: service_bill_id }, transaction }
        );

        await transaction.commit();

        return invoice;
    } catch (error) {
        await transaction.rollback();
        console.error("Error updating invoice:", error);
        throw error;
    }
};

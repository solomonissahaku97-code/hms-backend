const { ServiceBill, Insurance, Invoice, Visit,Claim } = require("../models");
const { addClaimItem } = require("../service/claimService");

/**
 * Handles billing with NHIA partial coverage + invoice integration
 */
async function handleBilling({
    transaction,
    patient_id,
    visit_id,
    service_id,
    service_type = "Service",
    description,
    unit_price,          // Market price
    nhia_unit_price = 0, // NHIA coverage amount
    quantity = service_type === 'Medication' ? undefined : 1,
    department_id,
    admin_id,
    claim_id = null,
    institution_id,
    gdrg_code = null
}) {
    // ✅ Validate quantity for medications
    if (service_type === 'Medication' && (!quantity || quantity < 1)) {
        throw new Error('Quantity is required for medications');
    }

    // ✅ Use NHIA price as fallback if market price is 0
    const effectiveUnitPrice = unit_price > 0 ? unit_price : nhia_unit_price;
    
    // ✅ Always calculate total based on effective price
    const totalAmount = effectiveUnitPrice * quantity;

    let nhiaAmount = 0;
    let patientAmount = totalAmount;

    // ✅ Check if patient has insurance
    const insurance = await Insurance.findOne({
        where: { patient_id, insured: true },
        transaction
    });

    if (insurance && claim_id) {
        console.log('Patient has insurance:', insurance.id);
        
        if (nhia_unit_price > 0) {
            // NHIA covers either their portion or the full amount if patient price is 0
            nhiaAmount = Math.min(nhia_unit_price * quantity, totalAmount);
            console.log('NHIA covers:', nhiaAmount);

            // Patient pays the remainder
            patientAmount = totalAmount - nhiaAmount;
            if (patientAmount < 0) patientAmount = 0;
        }

        console.log("DEBUG >> Insurance found:", insurance.id);
        console.log("DEBUG >> Claim ID:", claim_id);
        console.log("DEBUG >> NHIA Amount:", nhiaAmount);
        console.log("DEBUG >> Patient Amount:", patientAmount);

        // ✅ Add claim item
        await addClaimItem(
            claim_id,
            {
                item_type: service_type,
                item_id: service_id,
                gdrg_code,
                description,
                unit_price: effectiveUnitPrice,   // effective price
                quantity,
                nhia_amount: nhiaAmount,  // NHIA's portion
                amount: patientAmount,    // patient's portion
            },
            transaction
        );
    } else if (!insurance) {
        console.log('Patient has no insurance - paying full amount:', totalAmount);
        // No insurance = patient pays everything
        patientAmount = totalAmount;
        nhiaAmount = 0;
    }

    // ✅ Get or create invoice for this visit
    let invoice = await Invoice.findOne({
        where: { visit_id, status: 'draft' },
        transaction
    });

    if (!invoice) {
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        invoice = await Invoice.create({
            invoice_number: invoiceNumber,
            patient_id,
            visit_id,
            institution_id,
            total_amount: 0,
            amount_paid: 0,
            balance_due: 0,
            invoice_date: new Date(),
            status: 'draft'
        }, { transaction });
    }

    // ✅ Create service bill
    const serviceBill = await ServiceBill.create({
        visit_id,
        patient_id,
        institution_id,
        department_id,
        service_id,
        service_type,
        description,
        unit_price: effectiveUnitPrice,    // Use effective price
        quantity,
        total_amount: totalAmount,         // Full amount
        nhia_amount: nhiaAmount,
        patient_amount: patientAmount,
        admin_id,
        invoice_id: invoice.id,
        is_nhia_covered: nhiaAmount > 0,
        payment_status: 'Pending',
        has_paid: false
    }, { transaction });

    // ✅ Update invoice totals with financial rounding (Option 3)
    const currentTotal = parseFloat(invoice.total_amount);
    const currentBalance = parseFloat(invoice.balance_due);
    await invoice.update({
        total_amount: Math.round((currentTotal + totalAmount) * 100) / 100,
        amount_paid: Math.round((currentTotal - currentBalance) * 100) / 100,
        balance_due: Math.round((currentBalance + patientAmount) * 100) / 100
    }, { transaction });

    // update and compute claims total amount here
    if (claim_id) {
        const claim = await Claim.findByPk(claim_id, { transaction });
        if (claim) {
            const claimItems = await claim.getItems({ transaction });
            const totalClaimAmount = claimItems.reduce((sum, item) => sum + (item.nhia_amount || 0) + (item.amount || 0), 0);
            await claim.update({ total_amount: totalClaimAmount }, { transaction });
        }
    }

    // Return billing details

    return {
        totalAmount,       // full cost
        patientAmount,     // what patient pays
        nhiaAmount,        // what NHIA covers
        unit_price: effectiveUnitPrice,
        nhia_unit_price,
        quantity,
        invoice_id: invoice.id
    };
}

module.exports = { handleBilling };

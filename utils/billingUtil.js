const { ServiceBill, Insurance, Invoice, Visit, Claim, Payment, Patient, Service, Prescription, LabTestResult, Procedure } = require("../models");
const { addClaimItem } = require("../service/claimService");
const { v4: uuidv4 } = require("uuid");

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

    // ✅ Validate that the service exists based on service_type
    if (service_id) {
        switch (service_type) {
            case 'Medication':
                const medication = await Prescription.findByPk(service_id, { transaction });
                if (!medication) {
                    throw new Error(`Medication with ID ${service_id} not found`);
                }
                if (!description) {
                    description = `${medication.generic_name} ${medication.strength}`;
                }
                break;
            case 'LabTest':
                const labTest = await LabTestResult.findByPk(service_id, { transaction });
                if (!labTest) {
                    throw new Error(`LabTest with ID ${service_id} not found`);
                }
                if (!description) {
                    description = labTest.test_name;
                }
                break;
            case 'Procedure':
                const procedure = await Procedure.findByPk(service_id, { transaction });
                if (!procedure) {
                    throw new Error(`Procedure with ID ${service_id} not found`);
                }
                if (!description) {
                    description = procedure.procedure_name;
                }
                break;
            default:
                break;
        }
    }

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

    // ✅ Update invoice totals with financial rounding
    // Invoice total_amount should only reflect what the patient is responsible for,
    // not the full market price which includes amounts NHIA covers.
    const currentPatientTotal = parseFloat(invoice.total_amount) || 0;
    await invoice.update({
        total_amount: Math.round((currentPatientTotal + patientAmount) * 100) / 100,
    }, { transaction });

    // update and compute claims total amount here
    if (claim_id) {
        const claim = await Claim.findByPk(claim_id, { transaction });
        if (claim) {
            const claimItems = await claim.getItems({ transaction });
            const totalClaimAmount = claimItems.reduce((sum, item) => sum + (item.amount || 0), 0);
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

/**
 * Process a payment against an invoice or service bill
 * Supports full, partial, and overpayment handling
 */
async function processPayment({
    transaction,
    patient_id,
    invoice_id,
    service_bill_id,
    amount,
    payment_method,
    payment_type = 'full',
    transaction_reference,
    notes,
    created_by
}) {
    const paymentAmount = parseFloat(amount);

    if (paymentAmount <= 0) {
        throw new Error('Payment amount must be greater than zero');
    }

    // Determine the target: invoice or service bill
    let targetInvoice = null;
    let targetBill = null;

    if (invoice_id) {
        targetInvoice = await Invoice.findByPk(invoice_id, { transaction });
        if (!targetInvoice) {
            throw new Error('Invoice not found');
        }
        if (targetInvoice.balance_due <= 0) {
            throw new Error('Invoice is already fully paid');
        }
    } else if (service_bill_id) {
        targetBill = await ServiceBill.findByPk(service_bill_id, { transaction });
        if (!targetBill) {
            throw new Error('Service bill not found');
        }
        if (targetBill.payment_status === 'Paid') {
            throw new Error('Service bill is already fully paid');
        }
        targetInvoice = targetBill.invoice_id
            ? await Invoice.findByPk(targetBill.invoice_id, { transaction })
            : null;
    } else {
        throw new Error('Either invoice_id or service_bill_id is required');
    }

    // Create the payment record
    const payment = await Payment.create({
        id: uuidv4(),
        transactionId: transaction_reference || uuidv4(),
        status: 'completed',
        amount: paymentAmount,
        currency: 'GHS',
        paidAt: new Date(),
        invoice_id: targetInvoice ? targetInvoice.id : null,
        service_bill_id: targetBill ? targetBill.id : null,
        patient_id,
        payment_method,
        payment_type,
        notes,
        created_by
    }, { transaction });

    // Apply payment to service bill if applicable
    if (targetBill) {
        const currentPaid = parseFloat(targetBill.paid_amount) || 0;
        const newPaid = currentPaid + paymentAmount;
        const billTotal = parseFloat(targetBill.total_amount) || 0;

        targetBill.paid_amount = newPaid;
        targetBill.payment_method = payment_method;

        if (newPaid >= billTotal) {
            targetBill.payment_status = 'Paid';
            targetBill.has_paid = true;
            targetBill.paid_at = new Date();
        } else if (newPaid > 0) {
            targetBill.payment_status = 'Pending';
        }

        await targetBill.save({ transaction });
    }

    // Apply payment to invoice
    if (targetInvoice) {
        const currentAmountPaid = parseFloat(targetInvoice.amount_paid) || 0;
        const newAmountPaid = currentAmountPaid + paymentAmount;
        const newBalanceDue = Math.round((targetInvoice.total_amount - newAmountPaid) * 100) / 100;

        await targetInvoice.update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue > 0 ? newBalanceDue : 0,
            payment_method,
            status: newBalanceDue <= 0 ? 'paid' : (newAmountPaid > 0 ? 'partially_paid' : targetInvoice.status)
        }, { transaction });
    }

    return {
        payment_id: payment.id,
        transactionId: payment.transactionId,
        amount: paymentAmount,
        payment_method,
        status: 'completed',
        invoice_id: targetInvoice ? targetInvoice.id : null,
        service_bill_id: targetBill ? targetBill.id : null,
        remaining_balance: targetInvoice ? targetInvoice.balance_due : (targetBill ? (parseFloat(targetBill.total_amount) - parseFloat(targetBill.paid_amount)) : 0)
    };
}

/**
 * Apply NHIS payment to a claim
 * Used when NHIA directly pays a portion of a claim
 */
async function applyNhisPayment({
    transaction,
    claim_id,
    amount_paid,
    payment_reference
}) {
    const claim = await Claim.findByPk(claim_id, { transaction });
    if (!claim) {
        throw new Error('Claim not found');
    }

    const paymentAmount = parseFloat(amount_paid);
    if (paymentAmount <= 0) {
        throw new Error('Payment amount must be greater than zero');
    }

    // Update claim status
    await claim.update({
        claim_status: 'Approved',
        total_nhia_amount: (parseFloat(claim.total_nhia_amount) || 0) + paymentAmount
    }, { transaction });

    // Update all claim items that are NHIA-covered
    const claimItems = await claim.getItems({ transaction });
    for (const item of claimItems) {
        if (parseFloat(item.nhia_amount || 0) > 0) {
            const remainingNhia = parseFloat(item.nhia_amount) - paymentAmount;
            if (remainingNhia <= 0) {
                await item.update({
                    paid_by_patient: false,
                    nhia_amount: parseFloat(item.nhia_amount)
                }, { transaction });
                paymentAmount = paymentAmount - parseFloat(item.nhia_amount);
            } else {
                await item.update({
                    nhia_amount: remainingNhia
                }, { transaction });
                break;
            }
        }
    }

    // Create a payment record for the NHIS payment
    await Payment.create({
        id: uuidv4(),
        transactionId: payment_reference || uuidv4(),
        status: 'completed',
        amount: paymentAmount,
        currency: 'GHS',
        paidAt: new Date(),
        claim_id,
        payment_method: 'insurance',
        payment_type: 'nhis',
        notes: `NHIS payment for claim ${claim.claim_reference_number}`
    }, { transaction });

    return {
        claim_id,
        claim_reference: claim.claim_reference_number,
        amount_applied: paymentAmount,
        payment_reference: payment_reference || 'N/A',
        status: 'Applied'
    };
}

module.exports = { handleBilling, processPayment, applyNhisPayment };

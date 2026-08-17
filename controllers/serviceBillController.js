const Institution = require("../models/institution");
const Service = require("../models/service");
const ServiceBill = require("../models/serviceBill");
const Patient = require("../models/patient");
const Department = require("../models/department");
const Admin = require("../models/admin");
const Prescription = require("../models/prescription");
const LabTestResult = require("../models/lab/LabTestResult");
const Procedure = require("../models/procedure/procedure");
const Consultation = require("../models/Consultation");
const fs = require('fs');
const PDFDocument = require('pdfkit');
const sendEmail = require('../service/sendEmail');
const Notification = require("../models/notification");

async function resolveService(serviceBill) {
    switch (serviceBill.service_type) {
        case 'Medication':
            return await Prescription.findByPk(serviceBill.service_id);
        case 'LabTest':
            return await LabTestResult.findByPk(serviceBill.service_id);
        case 'Procedure':
            return await Procedure.findByPk(serviceBill.service_id);
        case 'Service':
        case 'Other':
            return await Service.findByPk(serviceBill.service_id);
        case 'Consultation':
            return await Consultation.findByPk(serviceBill.service_id);
        default:
            return null;
    }
}

const getRequesterInstitutionId = (req) => {
    const admin = req.admin;
    const user = req.user;
    if (admin && admin.institution_id) return admin.institution_id;
    if (user && user.institution_id) return user.institution_id;
    return null;
};

exports.createService = async (req, res) => {
    try {
        const { name, description, institution_id, cost, is_free } = req.body;

        if (!name || !description || !institution_id || cost === undefined) {
            return res.status(400).json({ success: false, message: 'Name, description, institution_id, and cost are required' });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || requesterInstitutionId !== institution_id) {
            return res.status(403).json({ success: false, message: 'You can only create services for your own institution.' });
        }

        const institution = await Institution.findByPk(institution_id);
        if (!institution) {
            return res.status(404).json({ success: false, message: 'Institution not found' });
        }

        const service = await Service.create({
            name,
            description,
            institution_id,
            cost: parseFloat(cost),
            is_free: !!is_free,
        });

        return res.status(201).json({ success: true, data: service });
    } catch (error) {
        console.error('Error creating service:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while creating the service', error: error.message });
    }
};

exports.getAllServices = async (req, res) => {
    try {
        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'Unable to determine institution.' });
        }

        const where = { institution_id: requesterInstitutionId };
        const services = await Service.findAll({ where });
        return res.status(200).json({ success: true, data: services });
    } catch (error) {
        console.error('Error fetching services:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch services', error: error.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, cost, is_free } = req.body;

        const service = await Service.findByPk(id);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || service.institution_id !== requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'You can only update services for your own institution.' });
        }

        const updatePayload = {};
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        if (cost !== undefined) updatePayload.cost = parseFloat(cost);
        if (is_free !== undefined) updatePayload.is_free = !!is_free;

        await service.update(updatePayload);

        return res.status(200).json({ success: true, data: service });
    } catch (error) {
        console.error('Error updating service:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while updating the service', error: error.message });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findByPk(id);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || service.institution_id !== requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'You can only delete services for your own institution.' });
        }

        await service.destroy();

        return res.status(200).json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while deleting the service', error: error.message });
    }
};

// DEPRECATED/REMOVED: exports.createPatientInvoice used to live here and was
// mounted at POST /invoices in routes/serviceRoutes.js. It was shadowed by
// routes/invoice.routes.js -> invoiceController.createInvoice and performed a
// raw ServiceBill.create() without a visit_id (ServiceBill.visit_id is NOT
// NULL), so it could never succeed. Generic Service billing now goes through
// the single canonical path: POST /api/v1/invoices -> invoiceController.
// createInvoice -> handleBilling().

exports.getPatientInvoices = async (req, res) => {
    try {
        const { patient_id, institution_id } = req.query;

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'Unable to determine institution.' });
        }

        const where = { patient_id };
        if (institution_id && institution_id !== requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'You can only view invoices for your own institution.' });
        }
        if (requesterInstitutionId) {
            where.institution_id = requesterInstitutionId;
        }

        const invoices = await ServiceBill.findAll({ where });

        if (!invoices || invoices.length === 0) {
            return res.status(404).json({ success: false, message: "No invoices found for this patient" });
        }

        const invoicesWithServices = [];
        for (const invoice of invoices) {
            const service = await resolveService(invoice);
            invoicesWithServices.push({
                ...invoice.toJSON(),
                service: service
            });
        }

        return res.status(200).json({ success: true, data: invoicesWithServices });
    } catch (error) {
        console.error('Error retrieving invoices:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while retrieving the invoices', error: error.message });
    }
};

exports.updatePatientInvoice = async (req, res) => {
    const transaction = await ServiceBill.sequelize.transaction();
    try {
        const { invoice_id } = req.params;
        const { amount, is_free } = req.body;

        const invoice = await ServiceBill.findByPk(invoice_id, { transaction });
        if (!invoice) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || invoice.institution_id !== requesterInstitutionId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'You can only update invoices for your own institution.' });
        }

        if (amount !== undefined) {
            invoice.total_amount = amount;
            invoice.patient_amount = amount;
        }
        await invoice.save({ transaction });

        await transaction.commit();

        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating invoice:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while updating the invoice', error: error.message });
    }
};

exports.deletePatientInvoice = async (req, res) => {
    const transaction = await ServiceBill.sequelize.transaction();
    try {
        const { invoice_id } = req.params;

        const invoice = await ServiceBill.findByPk(invoice_id, { transaction });
        if (!invoice) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || invoice.institution_id !== requesterInstitutionId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'You can only delete invoices for your own institution.' });
        }

        await invoice.destroy({ transaction });

        await transaction.commit();

        return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting invoice:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while deleting the invoice', error: error.message });
    }
};

exports.makePatientPayment = async (req, res) => {
    const { bill_ids, patient_id } = req.body;
    const transaction = await ServiceBill.sequelize.transaction();
    try {
        if (!Array.isArray(bill_ids)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'bill_ids must be an array' });
        }
        if (!patient_id) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'patient_id is required' });
        }

        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'Unable to determine institution.' });
        }

        const bills = await ServiceBill.findAll({
            where: {
                id: bill_ids,
                patient_id,
                has_paid: false,
                institution_id: requesterInstitutionId
            }
        });

        const foundIds = bills.map(b => b.id);
        const missingBillIds = bill_ids.filter(id => !foundIds.includes(id));

        if (missingBillIds.length > 0) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Some bills not found or already paid',
                missing_bill_ids: missingBillIds,
                paid_bill_ids: foundIds
            });
        }

        const [updatedCount] = await ServiceBill.update(
            { has_paid: true },
            {
                where: {
                    id: foundIds,
                    patient_id,
                    institution_id: requesterInstitutionId
                },
                transaction
            }
        );

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: 'Payments updated successfully',
            updated_count: updatedCount,
            bill_ids: foundIds
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating payments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update payments',
            details: error.message
        });
    }
};

exports.sendInvoiceToPatient = async (req, res) => {
    const { patient_id, email, institution_id } = req.body;

    try {
        const requesterInstitutionId = getRequesterInstitutionId(req);
        if (!requesterInstitutionId || institution_id !== requesterInstitutionId) {
            return res.status(403).json({ success: false, message: 'You can only send invoices for your own institution.' });
        }

        const patient = await Patient.findByPk(patient_id);
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const institution = await Institution.findByPk(institution_id);
        if (!institution) return res.status(404).json({ success: false, message: 'Institution not found' });

        const invoices = await ServiceBill.findAll({
            where: { patient_id, institution_id },
        });

        if (!invoices.length) return res.status(404).json({ success: false, message: 'No invoices found for this patient' });

        let totalAmount = 0;
        let paidAmount = 0;

        for (const invoice of invoices) {
            const service = await resolveService(invoice);
            invoice.service = service;
            const serviceCost = service ? (service.cost || 0) : 0;
            totalAmount += serviceCost;
            if (invoice.has_paid) paidAmount += serviceCost;
        }

        const remainingAmount = totalAmount - paidAmount;

        const doc = new PDFDocument();
        const filePath = `./patient_${patient.first_name}_invoice.pdf`;

        doc.pipe(fs.createWriteStream(filePath));

        doc.fontSize(18).text(institution.name, { align: 'center' });
        if (institution.logo_url) {
            doc.image(institution.logo_url, { fit: [100, 100], align: 'center' });
        }
        doc.fontSize(12)
            .text(`Address: ${institution.address}`)
            .text(`Contact: ${institution.contact}`)
            .text(`Email: ${institution.email}`)
            .moveDown();

        doc.fontSize(14).text(`Patient Name: ${patient.first_name}`);
        doc.text(`Patient ID: ${patient.id}`).moveDown();

        const headers = ['Service', 'Cost (₵)', 'Status'];
        const rows = invoices.map((invoice) => [
            invoice.service ? invoice.service.name : 'Unknown Service',
            invoice.service ? invoice.service.cost : 0,
            invoice.has_paid ? 'Paid' : 'Unpaid',
        ]);

        const tableWidth = 500;
        const columnWidths = [300, 100, 100];
        let currentY = doc.y + 10;

        headers.forEach((header, index) => {
            doc.font('Helvetica-Bold').fontSize(10).text(header, 50 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), currentY, { width: columnWidths[index], align: 'left' });
        });
        currentY += 20;

        rows.forEach((row) => {
            row.forEach((cell, index) => {
                doc.font('Helvetica').fontSize(10).text(cell, 50 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), currentY, { width: columnWidths[index], align: 'left' });
            });
            currentY += 20;
        });

        doc.moveDown().fontSize(14).text(`Total Amount: ${totalAmount} ₵`);
        doc.text(`Paid Amount: ${paidAmount} ₵`);
        doc.text(`Remaining Amount: ${remainingAmount} ₵`).moveDown();

        doc.text(`Please settle the remaining balance to ensure uninterrupted service. Thank you for choosing ${institution.name}.`);
        doc.end();

        await sendEmail(
            email,
            'Your Invoice',
            'invoice',
            {
                name: patient.first_name,
                invoices,
                totalAmount,
                paidAmount,
                remainingAmount,
                institution,
            },
            [
                {
                    filename: `patient_${patient_id}_invoice.pdf`,
                    path: filePath,
                },
            ],
        );

        fs.unlinkSync(filePath);

        return res.status(200).json({ success: true, message: 'Invoice sent successfully to the patient.' });
    } catch (error) {
        console.error('Error sending invoice:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while sending the invoice.', error: error.message });
    }
};

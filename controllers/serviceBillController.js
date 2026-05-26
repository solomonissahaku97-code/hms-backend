const Institution = require("../models/institution");
const Service = require("../models/service");
const ServiceBill = require("../models/serviceBill");
const Patient = require("../models/patient");
const Department = require("../models/department");
const Admin = require("../models/admin");
const fs = require('fs');
const PDFDocument = require('pdfkit');
const sendEmail = require('../service/sendEmail');
const Notification = require("../models/notification");



exports.createService = async (req, res) => {
    try {
        const { name, description, institution_id, cost } = req.body;

        if (!name || !description || !institution_id || !cost) {
            return res.status(500).json({ error: "An error occurred somewhere" });
        }

        const institution = await Institution.findOne({ where: { id: institution_id } });
        if (!institution) {
            return res.status(404).json({ error: "institution not found" });
        }

        // CREATE SERVICE 
        const service = await Service.create({
            name,
            description,
            institution_id,
            cost,
        });

        res.status(201).json({ success: "Service created successfully", data: service });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the service' });
    }
};

exports.getAllServices = async (req, res) => {
    const { institution_id } = req.query;

    try {
        const institution = await Institution.findOne({ where: { id: institution_id } })
        if (!institution) res.status(404).json({ error: 'institution does not exist' })
        const services = await Service.findAll()
        return res.status(200).json(services)
    } catch (error) {
        res.status(500).json({ error: '404 not found' });
    }
}

exports.deleteServiceBill = async (req, res) => {
    const { institution_id, admin_id, bill_id } = req.params;

    try {
        const admin = await Admin.findOne({ where: { institution_id: institution_id, id: admin_id } })
        if (!admin) res.status(404).json({ error: 'Admin does not exist' })

        const service = await Service.findByPk(bill_id)
        if (!service) res.status(404).json({ error: 'Service does not exist' })

        const deleteService = service.destroy()

        return res.status(200).json({ message: 'bill deleted successfully' })

    } catch (error) {
        res.status(500).json({ error: 'not found' });
    }
}




exports.createPatientInvoice = async (req, res) => {
    const { patient_id, department_id, service_id, staff_id, has_paid, institution_id } = req.body;
    try {
        // CREATE SERVICE BILL (INVOICE)
        const patient = await Patient.findByPk(patient_id, { where: { department_id } })
        if (!patient) return res.status(404).json({ error: "patient does not exist" })


        const invoice = await ServiceBill.create({
            patient_id,
            department_id,
            service_id,
            staff_id,
            has_paid,
            institution_id

        });

        res.status(201).json({ success: "Invoice created successfully", data: invoice });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the invoice' });
    }
};

exports.getPatientInvoices = async (req, res) => {

    const { patient_id, institution_id } = req.query;
    console.log(req.query)
    try {
        const invoices = await ServiceBill.findAll({
            where: { 'patient_id': patient_id, 'institution_id': institution_id }, include: [
                {
                    model: Service,
                    as: 'service'
                }
            ]
        });

        if (!invoices) {
            return res.status(404).json({ error: "No invoices found for this patient" });
        }

        res.status(200).json({ success: "Invoices retrieved successfully", data: invoices });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving the invoices' });
    }
};

exports.updatePatientInvoice = async (req, res) => {
    try {
        const { invoice_id } = req.params;
        const { amount, is_free } = req.body;

        const invoice = await ServiceBill.findByPk(invoice_id);

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        invoice.amount = amount !== undefined ? amount : invoice.amount;
        invoice.is_free = is_free !== undefined ? is_free : invoice.is_free;
        await invoice.save();

        res.status(200).json({ success: "Invoice updated successfully", data: invoice });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the invoice' });
    }
};

exports.deletePatientInvoice = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const invoice = await ServiceBill.findByPk(invoice_id);

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        await invoice.destroy();

        res.status(200).json({ success: "Invoice deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while deleting the invoice' });
    }
};


// MAKE PATIENT PAYMENT
exports.makePatientPayment = async (req, res) => {
    const { bill_ids, patient_id } = req.body; // Changed to req.body for better handling of arrays
    
    try {
        // Validate input
        if (!Array.isArray(bill_ids)) {
            return res.status(400).json({ error: 'bill_ids must be an array' });
        }
        if (!patient_id) {
            return res.status(400).json({ error: 'patient_id is required' });
        }

        // Find all unpaid bills for this patient with the provided IDs
        const bills = await ServiceBill.findAll({
            where: {
                id: bill_ids,
                patient_id: patient_id,
                has_paid: false // Only update unpaid bills
            }
        });

        if (!bills || bills.length === 0) {
            return res.status(404).json({ 
                error: 'No unpaid bills found for this patient with the provided IDs' 
            });
        }

        // Get the IDs of the bills we found
        const foundBillIds = bills.map(bill => bill.id);
        
        // Check if any requested bills weren't found
        const missingBillIds = bill_ids.filter(id => !foundBillIds.includes(id));
        if (missingBillIds.length > 0) {
            return res.status(404).json({ 
                error: 'Some bills not found or already paid',
                missing_bill_ids: missingBillIds,
                paid_bill_ids: foundBillIds
            });
        }

        // Update all found bills in a single transaction
        const updatedBills = await ServiceBill.update(
            { has_paid: true },
            {
                where: {
                    id: foundBillIds,
                    patient_id: patient_id
                }
            }
        );

        return res.status(200).json({ 
            success: 'Payments updated successfully',
            updated_count: updatedBills[0], // Number of affected rows
            bill_ids: foundBillIds
        });
    } catch (error) {
        console.error('Error updating payments:', error);
        res.status(500).json({ 
            error: 'Failed to update payments',
            details: error.message 
        });
    }
};



// Function to draw a table
const drawTable = (doc, headers, rows, startX, startY, columnWidths) => {
    let currentY = startY;

    // Draw header row
    headers.forEach((header, index) => {
        doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .text(header, startX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), currentY, {
                width: columnWidths[index],
                align: 'left',
                continued: index < headers.length - 1,
            });
    });
    currentY += 20;

    // Draw rows
    rows.forEach((row) => {
        row.forEach((cell, index) => {
            doc
                .font('Helvetica')
                .fontSize(10)
                .text(cell, startX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), currentY, {
                    width: columnWidths[index],
                    align: 'left',
                    continued: index < row.length - 1,
                });
        });
        currentY += 20;
    });

    // Draw table lines
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    doc.moveTo(startX, startY - 5).lineTo(startX + tableWidth, startY - 5).stroke();
    rows.forEach((_, rowIndex) => {
        doc.moveTo(startX, startY + rowIndex * 20 + 15).lineTo(startX + tableWidth, startY + rowIndex * 20 + 15).stroke();
    });
    columnWidths.reduce((acc, colWidth) => {
        doc.moveTo(startX + acc, startY - 5).lineTo(startX + acc, startY + rows.length * 20 + 15).stroke();
        return acc + colWidth;
    }, 0);
};

// Your function

exports.sendInvoiceToPatient = async (req, res) => {
    const { patient_id, email, institution_id } = req.body;

    try {
        const patient = await Patient.findByPk(patient_id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const institution = await Institution.findByPk(institution_id);
        if (!institution) return res.status(404).json({ error: 'Institution not found' });

        const invoices = await ServiceBill.findAll({
            where: { patient_id },
            include: [
                {
                    model: Service,
                    as: 'service',
                    attributes: ['name', 'cost'],
                },
            ],
        });

        if (!invoices.length) return res.status(404).json({ error: 'No invoices found for this patient' });

        let totalAmount = 0;
        let paidAmount = 0;

        invoices.forEach((invoice) => {
            totalAmount += invoice.service.cost;
            if (invoice.has_paid) paidAmount += invoice.service.cost;
        });

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

        // Table Headers and Data
        const headers = ['Service', 'Cost (₵)', 'Status'];
        const rows = invoices.map((invoice) => [
            invoice.service.name,
            invoice.service.cost,
            invoice.has_paid ? 'Paid' : 'Unpaid',
        ]);

        // Draw the table
        drawTable(doc, headers, rows, 50, doc.y + 10, [200, 150, 100]);

        // Add totals
        doc.moveDown().fontSize(14).text(`Total Amount: ${totalAmount} ₵`);
        doc.text(`Paid Amount: ${paidAmount} ₵`);
        doc.text(`Remaining Amount: ${remainingAmount} ₵`).moveDown();

        doc.text(
            `Please settle the remaining balance to ensure uninterrupted service. Thank you for choosing ${institution.name}.`,
        );

        doc.end();

        // Send Email with PDF
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

        res.status(200).json({ success: 'Invoice sent successfully to the patient.' });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: 'An error occurred while sending the invoice.' });
    }
};

  

// create controller to get




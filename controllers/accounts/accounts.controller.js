const { Op, fn, col, literal } = require("sequelize");
const { ServiceBill, Patient, Procedure, Prescription, LabTestResult } = require("../../models");
const Department = require("../../models/department");
const Staff = require("../../models/staff");
const Invoice = require("../../models/Invoice");

const AccountsController = {
    /**
     * 1. Outstanding Payments (Pending + Overdue)
     */
    async getOutstandingPayments(req, res) {
        try {
            const bills = await ServiceBill.findAll({
                where: {
                    payment_status: { [Op.in]: ["Pending", "Overdue"] }
                },
                include: [
                    { model: Patient, as: "patient", attributes: ["id", "first_name", "last_name"] },
                    { model: Department, as: "department", attributes: ["id", "name"] }
                ]
            });

            res.json({ success: true, data: bills });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * 2. NHIA Claims Summary
     */
    async getNHIAClaims(req, res) {
        try {
            // Step 1: Fetch all NHIA-covered bills
            const bills = await ServiceBill.findAll({
                where: { is_nhia_covered: true },
                attributes: [
                    "id",
                    "patient_id",
                    "service_id",
                    "service_type",
                    "nhia_amount",
                    "total_amount",
                    "created_at",
                ],
                include: [
                    {
                        model: Patient,
                        as: "patient",
                        // attributes: ["id", "first_name", "last_name"],
                    },
                ],
                raw: true,
                nest: true,
            });

            // Step 2: Fetch related services by type
            const [labTests, procedures, medications] = await Promise.all([
                LabTestResult.findAll(),
                Procedure.findAll(),
                Prescription.findAll(),
            ]);

            // Step 3: Map service details
            const labMap = Object.fromEntries(labTests.map(l => [l.id, l]));
            const procMap = Object.fromEntries(procedures.map(p => [p.id, p]));
            const medMap = Object.fromEntries(medications.map(m => [m.id, m]));

            // Step 4: Combine data into readable structure
            const result = bills.map(bill => {
                let serviceDetails = null;

                switch (bill.service_type) {
                    case "LabTest":
                        serviceDetails = labMap[bill.service_id] || { test_name: "Unknown Test" };
                        break;
                    case "Procedure":
                        serviceDetails = procMap[bill.service_id] || { procedure_name: "Unknown Procedure" };
                        break;
                    case "Medication":
                        serviceDetails = medMap[bill.service_id] || { generic_name: "Unknown Medication" };
                        break;
                    default:
                        serviceDetails = { description: "Other Service" };
                        break;
                }

                return {
                    ...bill,
                    serviceDetails,
                    patientName: `${bill.patient.first_name} ${bill.patient.last_name}`,
                };
            });

            // Step 5: Optionally aggregate per patient
            const grouped = result.reduce((acc, bill) => {
                const pid = bill.patient_id;
                if (!acc[pid]) {
                    acc[pid] = {
                        patient_id: pid,
                        patientName: bill.patientName,
                        total_nhia_amount: 0,
                        services: [],
                    };
                }
                acc[pid].total_nhia_amount += parseFloat(bill.nhia_amount || 0);
                acc[pid].services.push(bill);
                return acc;
            }, {});

            res.json({
                success: true,
                data: Object.values(grouped),
            });
        } catch (error) {
            console.error("❌ Error fetching NHIA claims:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * 3. Patient Collections Summary
     */
    async getPatientCollections(req, res) {
        try {
            const { visit_id } = req.params; // or req.query depending on your route

            if (!visit_id) {
                return res.status(400).json({
                    success: false,
                    message: "visit_id is required",
                });
            }

            // 1. Aggregate totals
            const totals = await ServiceBill.findOne({
                attributes: [
                    [fn("SUM", col("patient_amount")), "total_patient_amount"],
                    [fn("SUM", col("total_amount")), "total_billed_amount"],
                ],
                where: { visit_id },
                raw: true,
            });

            // 2. Detailed breakdown per service
            const details = await ServiceBill.findAll({
                where: { visit_id },

                include: [
                    {
                        model: Invoice,
                        as: 'invoice',
                    },
                    {
                        model: Department,
                        attributes: ["id", "name"],
                        as: 'department'
                    },
                ],
                order: [["created_at", "ASC"]],
            });

            res.json({
                success: true,
                totals,
                details,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    },

    /**
     * 4. Departmental Revenue Breakdown
     */
    async getDepartmentRevenue(req, res) {
        try {
            const revenue = await ServiceBill.findAll({
                attributes: [
                    "department_id",
                    [fn("SUM", col("total_amount")), "total_revenue"]
                ],
                include: [{ model: Department, as: "department", attributes: ["id", "name"] }],
                group: ["department_id", "department.id"]
            });

            res.json({ success: true, data: revenue });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * 5. Revenue by Service Type
     */
    async getServiceTypeRevenue(req, res) {
        try {
            const revenue = await ServiceBill.findAll({
                attributes: [
                    "service_type",
                    [fn("SUM", col("total_amount")), "total_revenue"]
                ],
                group: ["service_type"]
            });

            res.json({ success: true, data: revenue });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * 6. Staff Billing Report
     */
    async getStaffBilling(req, res) {
        try {
            const staffBilling = await ServiceBill.findAll({
                attributes: [
                    "staff_id",
                    [fn("SUM", col("total_amount")), "total_billed"]
                ],
                include: [{ model: Staff, as: "staff", attributes: ["id", "first_name", "last_name"] }],
                group: ["staff_id", "staff.id"]
            });

            res.json({ success: true, data: staffBilling });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * 7. Aging Report (how long bills stay unpaid)
     */
    async getAgingReport(req, res) {
        try {
            const aging = await ServiceBill.findAll({
                where: { payment_status: { [Op.ne]: "Paid" } },
                attributes: [
                    "id",
                    "created_at",
                    "payment_status",
                    "total_amount",
                    [literal("CURRENT_DATE - created_at"), "days_outstanding"]
                ]
            });

            res.json({ success: true, data: aging });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async getPatientBillsAndInvoices(req, res) {
        try {
            const { visit_id } = req.params;

            if (!visit_id) {
                return res.status(400).json({ success: false, error: "Patient ID is required" });
            }

            // Fetch all service bills for this patient
            const bills = await ServiceBill.findAll({
                where: { visit_id: visit_id },
                include: [
                    { model: Department, as: "department", attributes: ["id", "name"] },
                    { model: Staff, as: "staff", attributes: ["id", "first_name", "last_name"] },
                    { model: Invoice, as: "invoice" } // attach invoice data
                ],
                order: [["created_at", "DESC"]]
            });

            // Fetch invoices separately (useful if Accounts wants invoice summaries)
            const invoices = await Invoice.findAll({
                where: { visit_id: visit_id },
                order: [["created_at", "DESC"]]
            });

            res.json({
                success: true,
                data: {
                    bills,
                    invoices
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async getDashboard(req, res) {
        try {
            // Run queries in parallel for performance
            const [
                outstanding,
                nhiaClaims,
                patientCollections,
                departmentRevenue,
                serviceTypeRevenue,
                staffBilling,
                agingReport
            ] = await Promise.all([
                // 1. Outstanding Payments
                ServiceBill.findAll({
                    where: { payment_status: { [Op.in]: ["Pending", "Overdue"] } },
                    include: [
                        { model: Patient, as: "patient", attributes: ["id", "first_name", "last_name"] },
                        { model: Department, as: "department", attributes: ["id", "name"] }
                    ]
                }),

                // 2. NHIA Claims Summary
                ServiceBill.findAll({
                    attributes: [
                        [fn("SUM", col("nhia_amount")), "total_nhia_amount"],
                        [fn("COUNT", col("id")), "total_claims"]
                    ],
                    where: { is_nhia_covered: true }
                }),

                // 3. Patient Collections
                ServiceBill.findAll({
                    attributes: [
                        [fn("SUM", col("patient_amount")), "total_patient_amount"],
                        [fn("SUM", col("total_amount")), "total_billed_amount"]
                    ]
                }),

                // 4. Department Revenue
                ServiceBill.findAll({
                    attributes: [
                        "department_id",
                        [fn("SUM", col("total_amount")), "total_revenue"]
                    ],
                    include: [{ model: Department, as: "department", attributes: ["id", "name"] }],
                    group: ["department_id", "department.id"]
                }),

                // 5. Service Type Revenue
                ServiceBill.findAll({
                    attributes: [
                        "service_type",
                        [fn("SUM", col("total_amount")), "total_revenue"]
                    ],
                    group: ["service_type"]
                }),

                // 6. Staff Billing
                ServiceBill.findAll({
                    attributes: [
                        "staff_id",
                        [fn("SUM", col("total_amount")), "total_billed"]
                    ],
                    include: [{ model: Staff, as: "staff", }],
                    group: ["staff_id", "staff.id"]
                }),

                // 7. Aging Report
                ServiceBill.findAll({
                    where: { payment_status: { [Op.ne]: "Paid" } },
                    attributes: [
                        "id",
                        "created_at",
                        "payment_status",
                        "total_amount",
                        [literal("CURRENT_DATE - created_at"), "days_outstanding"]
                    ]
                })
            ]);

            res.json({
                success: true,
                data: {
                    outstanding,
                    nhiaClaims: nhiaClaims[0],
                    patientCollections: patientCollections[0],
                    departmentRevenue,
                    serviceTypeRevenue,
                    staffBilling,
                    agingReport
                }
            });

        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // mark a bill as paid
    async markBillAsPaid(req, res) {
        try {
            const { bill_id } = req.params;
            const { payment_method, paid_amount } = req.body;

            if (!bill_id || !payment_method || !paid_amount) {
                return res.status(400).json({ success: false, error: "bill_id, payment_method and paid_amount are required" });
            }

            const bill = await ServiceBill.findByPk(bill_id);
            if (!bill) {
                return res.status(404).json({ success: false, error: "Bill not found" });
            }

            // Update bill status and payment details
            bill.payment_status = "Paid";
            bill.payment_method = payment_method;
            bill.paid_amount = paid_amount;
            bill.paid_at = new Date();

            // check if paid amount is less than total amount
            if (parseFloat(paid_amount) < parseFloat(bill.patient_amount)) {
                bill.payment_status = "Partial";
            }
            if (parseFloat(paid_amount) > parseFloat(bill.total_amount)) {
                return res.status(400).json({ success: false, error: "Paid amount cannot be greater than total amount" });
            }

            // update invoice balance if linked
            if (bill.invoice_id) {
                const invoice = await Invoice.findByPk(bill.invoice_id);
                console.log("DEBUG >> Updating invoice:", invoice ? invoice.id : "No invoice found");
                if (invoice) {
                    invoice.amount_paid = parseFloat(invoice.amount_paid) + parseFloat(paid_amount);
                    invoice.balance_due = parseFloat(invoice.balance_due) - parseFloat(paid_amount);
                    console.log("DEBUG >> New invoice balance_due:", invoice.balance_due);
                    if (invoice.balance_due <= 0) {
                        invoice.balance_due = 0;
                        invoice.status = "paid";
                        console.log("DEBUG >> Invoice fully paid");
                    } else {
                        invoice.status = "partially_paid";
                        console.log("DEBUG >> Invoice partially paid");
                    }
                    await invoice.save();
                }
            }


            await bill.save();

            res.json({ success: true, message: "Bill marked as paid", data: bill });
        } catch (error) {
            console.log(error)
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // get paid history by patient id
    async getPaidHistoryByPatient(req, res) {
        try {
            const { patient_id } = req.query;

            if (!patient_id) {
                return res.status(400).json({ success: false, error: "Patient ID is required" });
            }

            const paidBills = await ServiceBill.findAll({
                where: {
                    patient_id: patient_id,
                    payment_status: "Paid"
                },
                include: [
                    { model: Department, as: "department", attributes: ["id", "name"] },
                    { model: Staff, as: "staff", attributes: ["id", "first_name", "last_name"] },
                    { model: Invoice, as: "invoice" }
                ],
                order: [["paid_at", "DESC"]]
            });

            res.json({
                success: true,
                data: paidBills
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // verify payments can be added here


};

module.exports = AccountsController;

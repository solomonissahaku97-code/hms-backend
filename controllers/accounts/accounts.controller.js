const { Op, fn, col, literal } = require("sequelize");
const { ServiceBill, Patient, Procedure, Prescription, LabTestResult, Invoice, Visit, Payment } = require("../../models");
const { v4: uuidv4 } = require("uuid");
const Department = require("../../models/department");
const Staff = require("../../models/staff");
const Institution = require("../../models/institution");

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
                    [fn("SUM", col("nhia_amount")), "total_nhia_amount"],
                    [fn("COUNT", col("id")), "items_count"],
                    [fn("SUM", col("patient_amount")), "total_patient_due"],
                ],
                where: { visit_id },
                raw: true,
            });

            // Patient amount still outstanding (unpaid bills)
            const dueResult = await ServiceBill.findOne({
                attributes: [
                    [fn("SUM", col("patient_amount")), "due"],
                ],
                where: { visit_id, has_paid: false },
                raw: true,
            });
            totals.total_patient_due = parseFloat(dueResult?.due || 0);

            // 2. Detailed breakdown per service
            const details = await ServiceBill.findAll({
                where: { visit_id },

                include: [
                    {
                        model: Invoice,
                        as: 'invoice',
                        include: [
                            {
                                model: Visit,
                                as: 'visit',
                                include: [
                                    {
                                        model: Patient,
                                        as: 'patient',
                                        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'folder_number', 'phone', 'has_insurance']
                                    }
                                ]
                            },
                            {
                                model: Institution,
                                as: 'institution',
                                attributes: ['id', 'name', 'address', 'contact', 'email']
                            }
                        ]
                    },
                    {
                        model: Patient,
                        as: 'patient',
                        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'folder_number', 'phone', 'has_insurance']
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
        const transaction = await Invoice.sequelize.transaction();
        try {
            const { bill_id } = req.params;
            const { payment_method, paid_amount } = req.body;

            if (!bill_id || !payment_method || !paid_amount) {
                await transaction.rollback();
                return res.status(400).json({ success: false, error: "bill_id, payment_method and paid_amount are required" });
            }

            const bill = await ServiceBill.findByPk(bill_id, { transaction });
            if (!bill) {
                await transaction.rollback();
                return res.status(404).json({ success: false, error: "Bill not found" });
            }

            // check if paid amount is less than total amount
            if (parseFloat(paid_amount) > parseFloat(bill.total_amount)) {
                await transaction.rollback();
                return res.status(400).json({ success: false, error: "Paid amount cannot be greater than total amount" });
            }

            const isFullyPaid = parseFloat(paid_amount) >= parseFloat(bill.total_amount);

            // Update bill status and payment details
            bill.paid_amount = parseFloat(paid_amount);
            bill.payment_method = payment_method;
            bill.paid_at = new Date();
            bill.has_paid = isFullyPaid;
            bill.payment_status = isFullyPaid ? "Paid" : "Pending";
            if (req.body.paid_by && req.body.paid_by !== 'Staff') {
                bill.staff_id = req.body.paid_by;
            }
            await bill.save({ transaction });

            // update invoice balance if linked
            if (bill.invoice_id) {
                const invoice = await Invoice.findByPk(bill.invoice_id, { transaction });
                if (invoice) {
                    invoice.amount_paid = parseFloat(invoice.amount_paid) + parseFloat(paid_amount);
                    invoice.balance_due = parseFloat(invoice.total_amount) - invoice.amount_paid;
                    if (invoice.balance_due <= 0) {
                        invoice.balance_due = 0;
                        invoice.status = "paid";
                    } else if (invoice.amount_paid > 0) {
                        invoice.status = "partially_paid";
                    }
                    await invoice.save({ transaction });
                }
            }

            await Payment.create({
                id: uuidv4(),
                transactionId: uuidv4(),
                status: 'completed',
                amount: parseFloat(paid_amount),
                currency: 'GHS',
                paidAt: new Date(),
                invoice_id: bill.invoice_id,
                service_bill_id: bill.id,
                patient_id: bill.patient_id,
                payment_method,
                payment_type: isFullyPaid ? 'full' : 'partial',
                notes: req.body.notes || `Payment for bill ${bill.id}`,
                created_by: req.body.paid_by
            }, { transaction });

            await transaction.commit();

            res.json({ success: true, message: "Bill marked as paid", data: bill });
        } catch (error) {
            await transaction.rollback();
            console.error("Error marking bill as paid:", error);
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
    },

    // verify payments can be added here

    /**
     * Daily Cash Flow - patient-specific invoices and total amounts collected per day
     */
    async getDailyCashFlow(req, res) {
        try {
            const { start_date, end_date, institution_id } = req.query;

            const whereClause = {};
            if (institution_id) {
                whereClause.institution_id = institution_id;
            }
            if (start_date && end_date) {
                whereClause.invoice_date = {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }; 
            }

            const dateFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

            // 1. Detailed invoice lines with patient info and service bills
            const invoices = await Invoice.findAll({
                where: whereClause,
                include: [
                    {
                        model: Visit,
                        as: 'visit',
                        include: [
                            {
                                model: Patient,
                                as: 'patient',
                                attributes: ['id', 'first_name', 'middle_name', 'last_name', 'phone', 'folder_number', 'has_insurance']
                            }
                        ]
                    },
                    {
                        model: Institution,
                        as: 'institution',
                        attributes: ['id', 'name']
                    },
                    {
                        model: ServiceBill,
                        as: 'service_bills',
                        attributes: ['id', 'service_type', 'description', 'total_amount', 'patient_amount', 'nhia_amount', 'has_paid', 'payment_status', 'created_at'],
                        include: [
                            { model: Department, as: 'department', attributes: ['id', 'name'] }
                        ]
                    }
                ],
                order: [['invoice_date', 'DESC']]
            });

            // Format invoice details with computed totals from service bills
            const formattedInvoices = invoices.map(inv => {
                const bills = inv.service_bills || [];
                const computedTotalPatient = bills.reduce((s, sb) => s + parseFloat(sb.patient_amount || 0), 0);
                const computedTotalNhia = bills.reduce((s, sb) => s + parseFloat(sb.nhia_amount || 0), 0);
                const computedTotal = computedTotalPatient + computedTotalNhia;
                const computedCollected = bills.filter(b => b.has_paid).reduce((s, b) => s + parseFloat(b.patient_amount || 0) + parseFloat(b.nhia_amount || 0), 0);
                const computedBalanceDue = computedTotal - computedCollected;

                let derivedStatus = inv.status;
                if (['cancelled', 'refunded', 'draft'].includes(inv.status)) {
                    // Preserve special statuses from database
                } else if (Math.abs(computedBalanceDue) < 0.01) {
                    derivedStatus = 'paid';
                } else if (computedCollected > 0) {
                    derivedStatus = 'partially_paid';
                } else {
                    derivedStatus = 'unpaid';
                }

                return {
                    id: inv.id,
                    invoice_number: inv.invoice_number,
                    invoice_date: inv.invoice_date,
                    due_date: inv.due_date,
                    total_amount: computedTotal,
                    patient_amount: computedTotalPatient,
                    nhia_amount: computedTotalNhia,
                    amount_paid: computedCollected,
                    balance_due: computedBalanceDue,
                    status: derivedStatus,
                    payment_method: inv.payment_method,
                    patient: inv.visit?.patient ? {
                        id: inv.visit.patient.id,
                        name: `${inv.visit.patient.first_name || ''} ${inv.visit.patient.last_name || ''}`.trim(),
                        first_name: inv.visit.patient.first_name,
                        last_name: inv.visit.patient.last_name,
                        phone: inv.visit.patient.phone,
                        folder_number: inv.visit.patient.folder_number,
                        has_insurance: inv.visit.patient.has_insurance
                    } : null,
                    institution: inv.institution?.name || '',
                    service_bills: bills.map(sb => ({
                        id: sb.id,
                        service_type: sb.service_type,
                        description: sb.description,
                        total_amount: parseFloat(sb.total_amount || 0),
                        patient_amount: parseFloat(sb.patient_amount || 0),
                        nhia_amount: parseFloat(sb.nhia_amount || 0),
                        has_paid: sb.has_paid,
                        payment_status: sb.payment_status,
                        department: sb.department?.name || '',
                        created_at: sb.created_at
                    }))
                };
            });

            // 2. Daily totals grouped by date (using computed values from service bills)
            const dailyTotalsMap = {};
            formattedInvoices.forEach(inv => {
                const dateKey = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : 'unknown';
                if (!dailyTotalsMap[dateKey]) {
                    dailyTotalsMap[dateKey] = {
                        date: dateKey,
                        total_invoiced: 0,
                        total_collected: 0,
                        total_balance_due: 0,
                        invoice_count: 0,
                        display_date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB', dateFormatOptions) : 'N/A'
                    };
                }
                dailyTotalsMap[dateKey].total_invoiced += inv.total_amount;
                dailyTotalsMap[dateKey].total_collected += inv.amount_paid;
                dailyTotalsMap[dateKey].total_balance_due += inv.balance_due;
                dailyTotalsMap[dateKey].invoice_count += 1;
            });

            const formattedDailyTotals = Object.values(dailyTotalsMap).map(row => ({
                date: row.date,
                total_invoiced: parseFloat(row.total_invoiced.toFixed(2)),
                total_collected: parseFloat(row.total_collected.toFixed(2)),
                total_balance_due: parseFloat(row.total_balance_due.toFixed(2)),
                invoice_count: row.invoice_count,
                display_date: row.display_date
            })).sort((a, b) => new Date(b.date) - new Date(a.date));

            // 3. Daily flow transactions compatible with cashflow table
            const categories = ['OPD', 'Pharmacy', 'Laboratory', 'Ward', 'Surgery', 'Maternity', 'NHIS', 'Consultation', 'Ambulance', 'Other'];
            const dailyFlow = [];
            formattedInvoices.forEach(inv => {
                const date = inv.invoice_date ? inv.invoice_date.toISOString() : new Date().toISOString();
                inv.service_bills.forEach((sb, idx) => {
                    dailyFlow.push({
                        key: `CF-${inv.id}-${idx}`,
                        date: date,
                        id: `TXN-${inv.invoice_number}-${idx}`,
                        category: categories[idx % categories.length],
                        description: `${sb.service_type}: ${sb.description || 'Service'}`,
                        amount: parseFloat(sb.patient_amount || 0),
                        type: 'In',
                        paymentMethod: inv.payment_method || 'cash',
                        status: inv.status === 'paid' ? 'Completed' : inv.status === 'unpaid' ? 'Pending' : 'Processing',
                        invoiceId: inv.id,
                        patientName: inv.patient?.name || 'Unknown',
                        totalAmount: inv.total_amount,
                        amountPaid: inv.amount_paid,
                        balanceDue: inv.balance_due,
                    });
                });
                if (inv.service_bills.length === 0) {
                    dailyFlow.push({
                        key: `CF-${inv.id}-0`,
                        date: date,
                        id: `TXN-${inv.invoice_number}`,
                        category: 'Other',
                        description: `Invoice ${inv.invoice_number}`,
                        amount: parseFloat(inv.total_amount || 0),
                        type: inv.total_amount > 0 ? 'In' : 'Out',
                        paymentMethod: inv.payment_method || 'cash',
                        status: inv.status === 'paid' ? 'Completed' : inv.status === 'unpaid' ? 'Pending' : 'Processing',
                        invoiceId: inv.id,
                        patientName: inv.patient?.name || 'Unknown',
                        totalAmount: inv.total_amount,
                        amountPaid: inv.amount_paid,
                        balanceDue: inv.balance_due,
                    });
                }
            });

            // 4. Group invoices by date for easy frontend consumption
            const invoicesByDate = formattedInvoices.reduce((acc, inv) => {
                const dateKey = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : 'unknown';
                if (!acc[dateKey]) {
                    acc[dateKey] = {
                        date: dateKey,
                        display_date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB', dateFormatOptions) : 'N/A',
                        invoices: [],
                        daily_total_collected: 0,
                        daily_total_invoiced: 0
                    };
                }
                acc[dateKey].invoices.push(inv);
                acc[dateKey].daily_total_collected += inv.amount_paid;
                acc[dateKey].daily_total_invoiced += inv.total_amount;
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    dailyTotals: formattedDailyTotals,
                    invoicesByDate: Object.values(invoicesByDate),
                    allInvoices: formattedInvoices,
                    dailyFlow: dailyFlow,
                    summary: {
                        total_collected: formattedDailyTotals.reduce((sum, d) => sum + d.total_collected, 0),
                        total_invoiced: formattedDailyTotals.reduce((sum, d) => sum + d.total_invoiced, 0),
                        total_balance_due: formattedDailyTotals.reduce((sum, d) => sum + d.total_balance_due, 0),
                        total_invoices: formattedDailyTotals.reduce((sum, d) => sum + d.invoice_count, 0),
                        day_count: formattedDailyTotals.length
                    }
                }
            });
        } catch (error) {
            console.error("Error fetching daily cash flow:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Accounts Report - clean financial summary with revenue, collections, and outstanding
     */
    async getAccountsReport(req, res) {
        try {
            const { start_date, end_date, institution_id } = req.query;

            const whereClause = {};
            if (institution_id) {
                whereClause.institution_id = institution_id;
            }
            if (start_date && end_date) {
                whereClause.invoice_date = {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                };
            }

            const dateFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

            const invoices = await Invoice.findAll({
                where: whereClause,
                attributes: ['id', 'invoice_number', 'invoice_date', 'total_amount', 'amount_paid', 'balance_due', 'status', 'payment_method'],
                include: [
                    {
                        model: Visit,
                        as: 'visit',
                        include: [
                            {
                                model: Patient,
                                as: 'patient',
                                attributes: ['id', 'first_name', 'middle_name', 'last_name', 'phone', 'folder_number', 'has_insurance']
                            }
                        ]
                    },
                    {
                        model: Institution,
                        as: 'institution',
                        attributes: ['id', 'name']
                    }
                ],
                order: [['invoice_date', 'DESC']]
            });

            const formattedInvoices = invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                total_amount: parseFloat(inv.total_amount || 0),
                amount_paid: parseFloat(inv.amount_paid || 0),
                balance_due: parseFloat(inv.balance_due || 0),
                status: inv.status,
                payment_method: inv.payment_method,
                patient: inv.visit?.patient ? {
                    id: inv.visit.patient.id,
                    name: `${inv.visit.patient.first_name || ''} ${inv.visit.patient.last_name || ''}`.trim(),
                    first_name: inv.visit.patient.first_name,
                    last_name: inv.visit.patient.last_name,
                    phone: inv.visit.patient.phone,
                    folder_number: inv.visit.patient.folder_number,
                    has_insurance: inv.visit.patient.has_insurance
                } : null,
                institution: inv.institution?.name || ''
            }));

            const totalInvoiced = formattedInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
            const totalCollected = formattedInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
            const totalOutstanding = formattedInvoices.reduce((sum, inv) => sum + inv.balance_due, 0);
            const totalPaid = formattedInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount_paid, 0);
            const totalPartiallyPaid = formattedInvoices.filter(inv => inv.status === 'partially_paid').reduce((sum, inv) => sum + inv.amount_paid, 0);
            const totalUnpaid = formattedInvoices.filter(inv => inv.status === 'unpaid').reduce((sum, inv) => sum + inv.balance_due, 0);

            const paidCount = formattedInvoices.filter(inv => inv.status === 'paid').length;
            const partiallyPaidCount = formattedInvoices.filter(inv => inv.status === 'partially_paid').length;
            const unpaidCount = formattedInvoices.filter(inv => inv.status === 'unpaid').length;

            const paymentMethods = {};
            formattedInvoices.forEach(inv => {
                if (inv.payment_method) {
                    paymentMethods[inv.payment_method] = (paymentMethods[inv.payment_method] || 0) + inv.amount_paid;
                }
            });

            const topPatients = formattedInvoices
                .sort((a, b) => b.total_amount - a.total_amount)
                .slice(0, 10)
                .map(inv => ({
                    patient_name: inv.patient?.name || 'Unknown',
                    total_amount: inv.total_amount,
                    amount_paid: inv.amount_paid,
                    balance_due: inv.balance_due
                }));

            const categories = ['OPD', 'Pharmacy', 'Laboratory', 'Ward', 'Surgery', 'Maternity', 'NHIS', 'Consultation', 'Ambulance', 'Other'];
            const dailyFlow = [];
            formattedInvoices.forEach(inv => {
                const date = inv.invoice_date ? inv.invoice_date.toISOString() : new Date().toISOString();
                const methodLabel = inv.payment_method ? inv.payment_method.replace('_', ' ').toUpperCase() : 'Cash';
                dailyFlow.push({
                    key: `RPT-${inv.id}`,
                    date: date,
                    id: inv.invoice_number,
                    category: 'Other',
                    description: `Invoice #${inv.invoice_number} - ${inv.patient?.name || 'Unknown'}`,
                    amount: parseFloat(inv.total_amount || 0),
                    type: inv.amount_paid > 0 ? 'In' : 'Out',
                    paymentMethod: methodLabel,
                    status: inv.status === 'paid' ? 'Completed' : inv.status === 'unpaid' ? 'Pending' : 'Processing',
                    invoiceId: inv.id,
                    patientName: inv.patient?.name || 'Unknown',
                    totalAmount: inv.total_amount,
                    amountPaid: inv.amount_paid,
                    balanceDue: inv.balance_due,
                });
            });

            res.json({
                success: true,
                data: {
                    summary: {
                        total_invoices: formattedInvoices.length,
                        total_invoiced: totalInvoiced,
                        total_collected: totalCollected,
                        total_outstanding: totalOutstanding,
                        total_paid: totalPaid,
                        total_partially_paid: totalPartiallyPaid,
                        total_unpaid: totalUnpaid,
                        collection_rate: totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : 0,
                        paid_count: paidCount,
                        partially_paid_count: partiallyPaidCount,
                        unpaid_count: unpaidCount
                    },
                    payment_methods: paymentMethods,
                    top_patients: topPatients,
                    invoices: formattedInvoices,
                    dailyFlow: dailyFlow
                }
            });
        } catch (error) {
            console.error("Error fetching accounts report:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
// 0506053964

    /**
     * Pay full invoice - marks all service bills and invoice as paid
     */
    async payInvoice(req, res) {
        const transaction = await Invoice.sequelize.transaction();
        try {
            const { invoice_id } = req.params;
            const { payment_method, paid_by, notes } = req.body;

            console.log('payInvoice body:', req.body, 'invoice_id:', invoice_id);

            if (!invoice_id || !payment_method) {
                await transaction.rollback();
                return res.status(400).json({ success: false, error: "invoice_id and payment_method are required" });
            }

            const invoiceWhereClause = { id: invoice_id };
            if (req.admin?.institution_id) {
                invoiceWhereClause.institution_id = req.admin.institution_id;
            }

            const invoice = await Invoice.findByPk(invoice_id, {
                where: invoiceWhereClause,
                include: [
                    { model: ServiceBill, as: 'service_bills' }
                ],
                transaction
            });

            if (!invoice) {
                return res.status(404).json({ success: false, error: "Invoice not found" });
            }

            if (invoice.balance_due <= 0) {
                return res.status(400).json({ success: false, error: "Invoice already fully paid" });
            }

            const paymentAmount = parseFloat(invoice.balance_due);
            const now = new Date();

            // Mark all unpaid service bills as paid
            let totalPatientPaid = 0;
            let totalNhiaPaid = 0;
            for (const bill of invoice.service_bills || []) {
                if (!bill.has_paid) {
                    bill.has_paid = true;
                    bill.payment_status = 'Paid';
                    bill.payment_method = payment_method;
                    bill.paid_at = now;
                    bill.paid_by = paid_by || null;
                    totalPatientPaid += parseFloat(bill.patient_amount || 0);
                    totalNhiaPaid += parseFloat(bill.nhia_amount || 0);
                    await bill.save({ transaction });
                }
            }

            // Update invoice
            invoice.amount_paid = parseFloat(invoice.total_amount);
            invoice.balance_due = 0;
            invoice.status = 'paid';
            invoice.payment_method = payment_method;
            invoice.paid_at = now;
            invoice.paid_by = paid_by || null;
            invoice.notes = notes || '';
            await invoice.save({ transaction });

            await Payment.create({
                id: uuidv4(),
                transactionId: uuidv4(),
                status: 'completed',
                amount: paymentAmount,
                currency: 'GHS',
                paidAt: now,
                invoice_id: invoice.id,
                patient_id: invoice.visit?.patient_id || invoice.patient_id,
                payment_method,
                payment_type: 'full',
                notes: notes || `Payment for invoice ${invoice.invoice_number}`,
                created_by: paid_by
            }, { transaction });

            await transaction.commit();

            res.json({
                success: true,
                message: "Invoice fully paid",
                data: {
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    amount_paid: paymentAmount,
                    total_patient_amount: totalPatientPaid,
                    total_nhia_amount: totalNhiaPaid,
                    payment_method,
                    paid_at: now
                }
            });
        } catch (error) {
            await transaction.rollback();
            console.error("Error paying invoice:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = AccountsController;

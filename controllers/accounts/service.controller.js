const { ServiceBill, Invoice, Visit, Patient, Service, Prescription, LabTestResult, Procedure } = require('../../models');

exports.createServiceBill = async (req, res) => {
  const transaction = await ServiceBill.sequelize.transaction();
  try {
    const { service_type, service_id, description, unit_price, quantity, patient_id, visit_id } = req.body;

    if (!service_type) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'service_type is required' });
    }

    // Validate service existence based on service_type
    if (service_id) {
      switch (service_type) {
        case 'Medication':
          const medication = await Prescription.findByPk(service_id, { transaction });
          if (!medication) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Medication with ID ${service_id} not found` });
          }
          if (!description) req.body.description = `${medication.generic_name} ${medication.strength}`;
          break;
        case 'LabTest':
          const labTest = await LabTestResult.findByPk(service_id, { transaction });
          if (!labTest) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `LabTest with ID ${service_id} not found` });
          }
          if (!description) req.body.description = labTest.test_name;
          break;
        case 'Procedure':
          const procedure = await Procedure.findByPk(service_id, { transaction });
          if (!procedure) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Procedure with ID ${service_id} not found` });
          }
          if (!description) req.body.description = procedure.procedure_name;
          break;
        default:
          break;
      }
    }

    const serviceBill = await ServiceBill.create(req.body, { transaction });

    const completeServiceBill = await ServiceBill.findByPk(serviceBill.id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: Invoice, as: 'invoice' },
        { model: Visit, as: 'visit' }
      ],
      transaction
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: completeServiceBill
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: 'Error creating service bill',
      error: error.message
    });
  }
};

exports.getServiceBillsByVisit = async (req, res) => {
  try {
    const { visit_id } = req.params;

    const serviceBills = await ServiceBill.findAll({
      where: { visit_id },
      include: [
        { model: Patient, as: 'patient' },
        { model: Invoice, as: 'invoice' }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: serviceBills
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: 'Error fetching service bills',
      error: error.message
    });
  }
};

exports.updateServiceBill = async (req, res) => {
  const transaction = await ServiceBill.sequelize.transaction();
  try {
    const { id } = req.params;

    const serviceBill = await ServiceBill.findByPk(id, { transaction });
    if (!serviceBill) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Service bill not found'
      });
    }

    const { service_type, service_id } = req.body;
    if (service_type && service_id) {
      switch (service_type) {
        case 'Medication':
          const medication = await Prescription.findByPk(service_id, { transaction });
          if (!medication) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Medication with ID ${service_id} not found` });
          }
          if (!req.body.description) req.body.description = `${medication.generic_name} ${medication.strength}`;
          break;
        case 'LabTest':
          const labTest = await LabTestResult.findByPk(service_id, { transaction });
          if (!labTest) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `LabTest with ID ${service_id} not found` });
          }
          if (!req.body.description) req.body.description = labTest.test_name;
          break;
        case 'Procedure':
          const procedure = await Procedure.findByPk(service_id, { transaction });
          if (!procedure) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: `Procedure with ID ${service_id} not found` });
          }
          if (!req.body.description) req.body.description = procedure.procedure_name;
          break;
        default:
          break;
      }
    }

    await serviceBill.update(req.body, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: serviceBill
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: 'Error updating service bill',
      error: error.message
    });
  }
};
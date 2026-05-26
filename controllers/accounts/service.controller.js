const { ServiceBill, Invoice, Visit, Patient } = require('../../models');

exports.createServiceBill = async (req, res) => {
  try {
    const serviceBill = await ServiceBill.create(req.body);
    
    const completeServiceBill = await ServiceBill.findByPk(serviceBill.id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: Invoice, as: 'invoice' },
        { model: Visit, as: 'visit' }
      ]
    });
    
    res.status(201).json({
      success: true,
      data: completeServiceBill
    });
  } catch (error) {
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
  try {
    const { id } = req.params;
    
    const serviceBill = await ServiceBill.findByPk(id);
    if (!serviceBill) {
      return res.status(404).json({
        success: false,
        message: 'Service bill not found'
      });
    }
    
    await serviceBill.update(req.body);
    
    res.json({
      success: true,
      data: serviceBill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating service bill',
      error: error.message
    });
  }
};
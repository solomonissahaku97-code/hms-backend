const medicationRoutes = require('./medicationRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const prescriptionRoutes = require('./prescriptionRoutes');
const dispensingRoutes = require('./dispensingRoutes');
const dashboardRoutes = require('./dashboardRoutes');

module.exports = (app) => {
  // Drug catalog
  app.use('/api/v1/pharmacy/medications', medicationRoutes);

  // Inventory/batch management
  app.use('/api/v1/pharmacy/inventory', inventoryRoutes);

  // Prescriptions
  app.use('/api/v1/pharmacy/prescriptions', prescriptionRoutes);

  // Dispensing
  app.use('/api/v1/pharmacy/dispensing', dispensingRoutes);

  // Dashboard
  app.use('/api/v1/pharmacy/dashboard', dashboardRoutes);
};

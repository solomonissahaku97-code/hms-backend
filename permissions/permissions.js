exports.permissions = [
  // Lab
  { name: 'request_lab', description: 'Request lab tests' },
  { name: 'manage_lab_results', description: 'Enter and manage lab test results' },
  { name: 'view_lab_results', description: 'View lab test results' },
  { name: 'approve_lab_results', description: 'Approve/release lab results' },

  // Pharmacy
  { name: 'request_pharmacy', description: 'Request medications/prescriptions' },
  { name: 'manage_prescriptions', description: 'Create and manage prescriptions' },
  { name: 'dispense_pharmacy', description: 'Dispense medications' },
  { name: 'view_pharmacy', description: 'View pharmacy/prescriptions' },

  // Procedures
  { name: 'request_procedure', description: 'Request procedures' },
  { name: 'manage_procedures', description: 'Manage and update procedures' },
  { name: 'view_procedures', description: 'View procedures' },

  // Patient Records
  { name: 'view_patient_details', description: 'View patient details and records' },
  { name: 'edit_patient_details', description: 'Edit patient information' },
  { name: 'create_patient', description: 'Register new patients' },
  { name: 'view_patient_history', description: 'View patient visit history' },

  // Communication
  { name: 'chat_departments', description: 'Chat within department' },
  { name: 'chat_institution', description: 'Access institution-wide chat' },
  { name: 'send_notifications', description: 'Send notifications' },

  // Billing & Insurance
  { name: 'manage_billing', description: 'Process payments and manage billing' },
  { name: 'view_billing', description: 'View bills and invoices' },
  { name: 'approve_claims', description: 'Approve insurance claims' },
  { name: 'view_claims', description: 'View insurance claims' },

  // Maternity
  { name: 'view_anc', description: 'View ANC records' },
  { name: 'manage_anc', description: 'Manage ANC records' },
  { name: 'view_deliveries', description: 'View delivery records' },
  { name: 'manage_deliveries', description: 'Record and manage deliveries' },
  { name: 'view_partograph', description: 'View partographs' },
  { name: 'manage_partograph', description: 'Manage partograph records' },

  // Appointments
  { name: 'view_appointments', description: 'View appointments' },
  { name: 'manage_appointments', description: 'Create and manage appointments' },

  // Department Access
  { name: 'access_records', description: 'Access patient records department' },
  { name: 'access_opd', description: 'Access OPD' },
  { name: 'access_maternity', description: 'Access maternity department' },
  { name: 'access_lab', description: 'Access lab department' },
  { name: 'access_pharmacy', description: 'Access pharmacy department' },
  { name: 'access_radiology', description: 'Access radiology department' },
  { name: 'access_stores', description: 'Access stores/inventory' },
  { name: 'access_consultation', description: 'Access consultation' },

  // Admin
  { name: 'manage_staff', description: 'Create and manage staff accounts' },
  { name: 'manage_roles', description: 'Manage roles and permissions' },
  { name: 'view_reports', description: 'View system reports and statistics' },
  { name: 'manage_settings', description: 'Manage system settings' },
  { name: 'manage_departments', description: 'Manage departments' },

  // Clinical
  { name: 'manage_diagnosis', description: 'Create and manage diagnoses' },
  { name: 'manage_vitals', description: 'Record and manage vital signs' },
  { name: 'manage_medications', description: 'Manage medications and prescriptions' },
  { name: 'manage_immunization', description: 'Manage immunizations' },
  { name: 'manage_allergies', description: 'Manage patient allergies' },

  // Inventory/Store
  { name: 'manage_inventory', description: 'Manage store inventory' },
  { name: 'manage_purchase_orders', description: 'Manage purchase orders' },
  { name: 'manage_suppliers', description: 'Manage suppliers' },
  { name: 'view_inventory_reports', description: 'View inventory reports' },
];

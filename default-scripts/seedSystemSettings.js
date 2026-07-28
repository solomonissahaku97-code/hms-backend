const SystemSetting = require('../models/SystemSetting');

const defaultSettings = [
  // General
  { key: 'institution_name', value: 'My Hospital', type: 'string', category: 'general', description: 'Hospital / Institution name' },
  { key: 'timezone', value: 'Africa/Accra', type: 'string', category: 'general', description: 'Default timezone' },
  { key: 'language', value: 'en', type: 'string', category: 'general', description: 'Default language' },
  { key: 'date_format', value: 'YYYY-MM-DD', type: 'string', category: 'general', description: 'Default date format' },
  { key: 'currency', value: 'GHS', type: 'string', category: 'general', description: 'Default currency' },
  { key: 'enable_maintenance_mode', value: 'false', type: 'boolean', category: 'general', description: 'Enable maintenance mode' },

  // Email
  { key: 'smtp_host', value: '', type: 'string', category: 'email', description: 'SMTP host' },
  { key: 'smtp_port', value: '587', type: 'number', category: 'email', description: 'SMTP port' },
  { key: 'smtp_user', value: '', type: 'string', category: 'email', description: 'SMTP username' },
  { key: 'smtp_password', value: '', type: 'string', category: 'email', description: 'SMTP password' },
  { key: 'smtp_from', value: '', type: 'string', category: 'email', description: 'From email address' },
  { key: 'smtp_secure', value: 'false', type: 'boolean', category: 'email', description: 'Use SMTP TLS/SSL' },
  { key: 'enable_email_notifications', value: 'true', type: 'boolean', category: 'email', description: 'Enable email notifications' },

  // Security
  { key: 'session_timeout', value: '30', type: 'number', category: 'security', description: 'Session timeout in minutes' },
  { key: 'password_min_length', value: '8', type: 'number', category: 'security', description: 'Minimum password length' },
  { key: 'require_special_char', value: 'true', type: 'boolean', category: 'security', description: 'Require special character in password' },
  { key: 'require_number', value: 'true', type: 'boolean', category: 'security', description: 'Require number in password' },
  { key: 'require_uppercase', value: 'true', type: 'boolean', category: 'security', description: 'Require uppercase in password' },
  { key: 'max_login_attempts', value: '5', type: 'number', category: 'security', description: 'Max login attempts before lockout' },
  { key: 'lockout_duration', value: '15', type: 'number', category: 'security', description: 'Account lockout duration in minutes' },
  { key: 'enable_2fa', value: 'false', type: 'boolean', category: 'security', description: 'Enable two-factor authentication' },
  { key: 'enforce_password_change', value: '90', type: 'number', category: 'security', description: 'Force password change every X days' },

  // Notifications
  { key: 'enable_sms_notifications', value: 'false', type: 'boolean', category: 'notifications', description: 'Enable SMS notifications' },
  { key: 'enable_push_notifications', value: 'true', type: 'boolean', category: 'notifications', description: 'Enable push notifications' },
  { key: 'notify_new_patient', value: 'true', type: 'boolean', category: 'notifications', description: 'Notify on new patient registration' },
  { key: 'notify_appointment', value: 'true', type: 'boolean', category: 'notifications', description: 'Notify on appointment updates' },
  { key: 'notify_lab_results', value: 'true', type: 'boolean', category: 'notifications', description: 'Notify when lab results are available' },
  { key: 'notify_prescription', value: 'true', type: 'boolean', category: 'notifications', description: 'Notify on new prescriptions' },
  { key: 'notify_payment', value: 'true', type: 'boolean', category: 'notifications', description: 'Notify on payment received' },
];

const seedSystemSettings = async () => {
  try {
    let created = 0;
    let skipped = 0;

    for (const setting of defaultSettings) {
      const existing = await SystemSetting.findOne({ where: { key: setting.key } });
      if (!existing) {
        await SystemSetting.create(setting);
        created++;
      } else {
        skipped++;
      }
    }

    console.log(`✅ System settings seeded: ${created} created, ${skipped} already existed`);
  } catch (error) {
    console.error('Error seeding system settings:', error);
    throw error;
  }
};

module.exports = seedSystemSettings;

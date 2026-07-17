/**
 * Shared catalog of subscription feature keys.
 *
 * These keys are stored in Subscription.features (array of strings) and
 * checked by middlewares/subscriptionGuard.js via requiredFeature.
 * Keep backend and frontend copies in sync.
 */
const SUBSCRIPTION_FEATURES = {
  'dept:enabled': 'Department Management',
  'lab:enabled': 'Laboratory',
  'pharmacy:enabled': 'Pharmacy',
  'theatre:enabled': 'Theatre / Surgery',
  'claims:enabled': 'NHIA Claims / Vetting',
  'maternity:enabled': 'Maternity (ANC/PNC)',
  'beds:enabled': 'Ward & Bed Management',
  'appointments:enabled': 'Appointments & Scheduling',
  'sms:enabled': 'SMS Notifications',
  'analytics:enabled': 'Analytics & Reports',
  'ai:enabled': 'AI Features',
};

module.exports = SUBSCRIPTION_FEATURES;

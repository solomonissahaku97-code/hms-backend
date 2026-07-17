const moment = require('moment');

const Subscription = require('../models/subscription');
const InstitutionSubscription = require('../models/InstitutionSubscription');

/**
 * subscriptionGuard(options)
 *
 * Usage example:
 *   const subscriptionGuard = require('../middlewares/subscriptionGuard');
 *
 *   router.post('/departments', auth, subscriptionGuard({
 *     requiredFeature: 'dept:lab:enabled',
 *     requiredLimit: { key: 'staff:users:limit', type: 'max' } // optional
 *   }), createDepartmentController);
 */
function subscriptionGuard(options = {}) {
  const {
    requiredFeature,
    requiredLimit, // { key: string, min?: number, max?: number, type?: 'max'|'min' }
    errorCode = 'UPGRADE_REQUIRED',
  } = options;

  return async (req, res, next) => {
    try {
      // Your app seems to use either req.user or req.admin.
      // For institution actions, you likely have institution_id on those.
      const actor = req.user || req.admin;
      const institutionId = actor?.institution_id || actor?.institutionId;

      if (!institutionId) {
        return res.status(403).json({ message: 'Unauthorized access.', code: 'UNAUTHORIZED' });
      }

      // If you have a consistent auth middleware that sets these values, great.
      // Otherwise, we rely on InstitutionSubscription model and expiryDate.
      const activeInstitutionSub = await InstitutionSubscription.findOne({
        where: { institutionId },
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Subscription,
            as: 'subscription',
          },
        ],
      });

      // Some Sequelize setups might not auto-include associations. Fallback:
      let subscription = null;
      let institutionSub = activeInstitutionSub;

      if (institutionSub?.subscription) {
        subscription = institutionSub.subscription;
      }

      if (!subscription && institutionSub?.subscriptionId) {
        subscription = await Subscription.findByPk(institutionSub.subscriptionId);
      }

      if (!institutionSub || !subscription) {
        return res.status(403).json({ message: 'No active subscription found.', code: errorCode });
      }

      // Validate expiry
      if (institutionSub.expiryDate && moment().isAfter(institutionSub.expiryDate)) {
        return res.status(403).json({ message: 'Subscription expired.', code: errorCode });
      }

      const features = subscription.features || {};

      // Normalize features into a lookup set that supports BOTH storage formats:
      //  - object map:  { 'dept:enabled': true, 'sms:limit': 500 }
      //  - array:       ['Telemedicine', 'SMS', 'dept:enabled']
      const featureSet = {};
      if (Array.isArray(features)) {
        features.forEach((f) => {
          if (typeof f === 'string') featureSet[f.trim()] = true;
        });
      } else if (typeof features === 'object' && features !== null) {
        Object.keys(features).forEach((k) => {
          featureSet[k] = features[k];
        });
      }

      // 1) Feature flag check
      if (requiredFeature) {
        const allowed = Array.isArray(features)
          ? features.some((f) => typeof f === 'string' && f.trim() === requiredFeature)
          : !!featureSet[requiredFeature];
        if (!allowed) {
          return res.status(403).json({
            message: 'This feature is not included in your plan.',
            code: errorCode,
            requiredFeature,
          });
        }
      }

      // 2) Limit check (optional)
      // Your subscription.features should store numeric limits.
      // Example: features = { 'staff:users:limit': 10, 'sms:monthly_quota': 500 }
      if (requiredLimit?.key) {
        const limitValue = featureSet[requiredLimit.key];
        if (typeof limitValue !== 'number') {
          return res.status(403).json({
            message: 'Plan entitlement missing required limit.',
            code: errorCode,
            requiredLimitKey: requiredLimit.key,
          });
        }

        // For generic guards, you still need to know the requested usage/current usage.
        // By default, we expect the controller to provide it:
        //   req.subscriptionUsage[requiredLimit.key] = currentValue
        // If missing, we skip the numeric comparison.
        const usage = req.subscriptionUsage?.[requiredLimit.key];
        if (typeof usage === 'number') {
          // Default: max
          const type = requiredLimit.type || 'max';
          if (type === 'max' && usage > limitValue) {
            return res.status(403).json({
              message: 'Plan limit exceeded.',
              code: errorCode,
              requiredLimitKey: requiredLimit.key,
              limit: limitValue,
              usage,
            });
          }
          if (type === 'min' && usage < limitValue) {
            return res.status(403).json({
              message: 'Plan minimum requirement not met.',
              code: errorCode,
              requiredLimitKey: requiredLimit.key,
              limit: limitValue,
              usage,
            });
          }
        }
      }

      // Attach resolved subscription info to request for reuse
      req.activeSubscription = {
        subscriptionId: institutionSub.subscriptionId,
        subscriptionName: subscription.name,
        features: subscription.features,
        expiryDate: institutionSub.expiryDate,
      };

      return next();
    } catch (err) {
      console.error('subscriptionGuard error:', err);
      return res.status(500).json({ message: 'Internal server error', code: 'SUBSCRIPTION_GUARD_ERROR' });
    }
  };
}

module.exports = subscriptionGuard;


/**
 * Subscription Controller — manages plans, institution subscriptions, billing.
 * 
 * Tables: subscriptions, institution_subscriptions, institutions
 */

const { QueryTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const uuidv4 = () => crypto.randomUUID();

// ─── GET All Subscription Plans ───────────────────────────────
exports.getPlans = async (req, res) => {
  try {
    const plans = await sequelize.query(
      `SELECT id, name, price, duration, features, status, "createdAt"
       FROM subscriptions
       WHERE status = true
       ORDER BY price ASC`,
      { type: QueryTypes.SELECT }
    );
    return res.json({ success: true, plans, total: plans.length });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to fetch plans', success: false });
  }
};

// ─── GET Single Plan ──────────────────────────────────────────
exports.getPlan = async (req, res) => {
  const { id } = req.params;
  try {
    const [plan] = await sequelize.query(
      `SELECT id, name, price, duration, features, status, "createdAt"
       FROM subscriptions WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found', success: false });
    return res.json({ success: true, plan });
  } catch (err) {
    console.error('Get plan error:', err);
    res.status(500).json({ error: 'Failed to fetch plan', success: false });
  }
};

// ─── POST Create Plan (Super Admin) ───────────────────────────
exports.createPlan = async (req, res) => {
  const { name, price, duration, features } = req.body;
  if (!name || price === undefined || !duration) {
    return res.status(400).json({ error: 'name, price, and duration are required', success: false });
  }

  try {
    const id = uuidv4();
    await sequelize.query(
      `INSERT INTO subscriptions (id, name, price, duration, features, status, "createdAt", "updatedAt")
       VALUES (:id, :name, :price, :duration, :features, true, NOW(), NOW())`,
      {
        replacements: {
          id, name, price, duration,
          features: JSON.stringify(features || []),
        },
        type: QueryTypes.INSERT,
      }
    );
    return res.status(201).json({ success: true, message: 'Plan created', plan: { id, name, price, duration, features } });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Failed to create plan', success: false });
  }
};

// ─── PUT Update Plan ──────────────────────────────────────────
exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, price, duration, features, status } = req.body;

  try {
    const [existing] = await sequelize.query(
      `SELECT id FROM subscriptions WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!existing) return res.status(404).json({ error: 'Plan not found', success: false });

    await sequelize.query(
      `UPDATE subscriptions SET
        name = COALESCE(:name, name),
        price = COALESCE(:price, price),
        duration = COALESCE(:duration, duration),
        features = COALESCE(:features, features),
        status = COALESCE(:status, status),
        "updatedAt" = NOW()
       WHERE id = :id`,
      {
        replacements: {
          id, name: name || null, price: price || null,
          duration: duration || null,
          features: features ? JSON.stringify(features) : null,
          status: status !== undefined ? status : null,
        },
        type: QueryTypes.UPDATE,
      }
    );
    return res.json({ success: true, message: 'Plan updated' });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Failed to update plan', success: false });
  }
};

// ─── DELETE Plan ──────────────────────────────────────────────
exports.deletePlan = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if any institution uses this plan
    const [active] = await sequelize.query(
      `SELECT COUNT(*) as count FROM institution_subscriptions WHERE "subscriptionId" = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (parseInt(active.count) > 0) {
      return res.status(400).json({ error: 'Cannot delete plan with active subscribers', success: false });
    }

    await sequelize.query(`DELETE FROM subscriptions WHERE id = :id`, { replacements: { id }, type: QueryTypes.DELETE });
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Delete plan error:', err);
    res.status(500).json({ error: 'Failed to delete plan', success: false });
  }
};

// ─── GET Institution Subscription Status ──────────────────────
exports.getInstitutionSubscription = async (req, res) => {
  const { institution_id } = req.params;

  try {
    const [sub] = await sequelize.query(
      `SELECT
        isub.id, isub."startDate", isub."expiryDate",
        s.id as plan_id, s.name as plan_name, s.price, s.duration, s.features,
        i.name as institution_name, i.serial_code
       FROM institution_subscriptions isub
       JOIN subscriptions s ON isub."subscriptionId" = s.id
       JOIN institutions i ON isub."institutionId" = i.id
       WHERE isub."institutionId" = :institution_id
       ORDER BY isub."createdAt" DESC
       LIMIT 1`,
      { replacements: { institution_id }, type: QueryTypes.SELECT }
    );

    if (!sub) {
      return res.json({ success: true, subscription: null, status: 'none', message: 'No active subscription' });
    }

    const now = new Date();
    const expiry = new Date(sub.expiryDate);
    const isExpired = expiry < now;
    const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

    return res.json({
      success: true,
      subscription: {
        ...sub,
        is_expired: isExpired,
        days_remaining: daysRemaining,
        status: isExpired ? 'expired' : 'active',
      },
    });
  } catch (err) {
    console.error('Get institution subscription error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription', success: false });
  }
};

// ─── POST Assign Subscription to Institution ──────────────────
exports.assignSubscription = async (req, res) => {
  const { institution_id, subscription_id } = req.body;
  if (!institution_id || !subscription_id) {
    return res.status(400).json({ error: 'institution_id and subscription_id are required', success: false });
  }

  try {
    // Verify institution exists
    const [institution] = await sequelize.query(
      `SELECT id, name FROM institutions WHERE id = :id`,
      { replacements: { id: institution_id }, type: QueryTypes.SELECT }
    );
    if (!institution) return res.status(404).json({ error: 'Institution not found', success: false });

    // Verify plan exists
    const [plan] = await sequelize.query(
      `SELECT id, name, duration FROM subscriptions WHERE id = :id AND status = true`,
      { replacements: { id: subscription_id }, type: QueryTypes.SELECT }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found or inactive', success: false });

    // Calculate expiry date based on plan duration
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.duration);

    // Create subscription record
    const subId = uuidv4();
    await sequelize.query(
      `INSERT INTO institution_subscriptions (id, "institutionId", "subscriptionId", "startDate", "expiryDate", "createdAt", "updatedAt")
       VALUES (:id, :instId, :subId, :startDate, :expiryDate, NOW(), NOW())`,
      {
        replacements: {
          id: subId,
          instId: institution_id,
          subId: subscription_id,
          startDate: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
        },
        type: QueryTypes.INSERT,
      }
    );

    // Update institution's subscription reference
    await sequelize.query(
      `UPDATE institutions SET "subscriptionId" = :subId WHERE id = :instId`,
      { replacements: { subId: subscription_id, instId: institution_id }, type: QueryTypes.UPDATE }
    );

    return res.status(201).json({
      success: true,
      message: `Subscription "${plan.name}" assigned to ${institution.name}`,
      subscription: {
        id: subId,
        institution: institution.name,
        plan: plan.name,
        start_date: startDate,
        expiry_date: expiryDate,
        duration_days: plan.duration,
      },
    });
  } catch (err) {
    console.error('Assign subscription error:', err);
    res.status(500).json({ error: 'Failed to assign subscription', success: false });
  }
};

// ─── POST Renew Subscription ──────────────────────────────────
exports.renewSubscription = async (req, res) => {
  const { institution_id } = req.body;
  if (!institution_id) {
    return res.status(400).json({ error: 'institution_id is required', success: false });
  }

  try {
    const [current] = await sequelize.query(
      `SELECT isub.*, s.duration, s.name as plan_name
       FROM institution_subscriptions isub
       JOIN subscriptions s ON isub."subscriptionId" = s.id
       WHERE isub."institutionId" = :institution_id
       ORDER BY isub."expiryDate" DESC
       LIMIT 1`,
      { replacements: { institution_id }, type: QueryTypes.SELECT }
    );

    if (!current) {
      return res.status(404).json({ error: 'No active subscription to renew', success: false });
    }

    // Extend from current expiry date
    const currentExpiry = new Date(current.expiryDate);
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + current.duration);

    await sequelize.query(
      `UPDATE institution_subscriptions SET "expiryDate" = :expiry, "updatedAt" = NOW()
       WHERE id = :id`,
      { replacements: { expiry: newExpiry.toISOString(), id: current.id }, type: QueryTypes.UPDATE }
    );

    return res.json({
      success: true,
      message: `Subscription renewed until ${newExpiry.toISOString().split('T')[0]}`,
      subscription: {
        plan: current.plan_name,
        old_expiry: currentExpiry,
        new_expiry: newExpiry,
      },
    });
  } catch (err) {
    console.error('Renew subscription error:', err);
    res.status(500).json({ error: 'Failed to renew subscription', success: false });
  }
};

// ─── GET All Institution Subscriptions (Admin/Super Admin) ────
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subs = await sequelize.query(
      `SELECT
        isub.id, isub."startDate", isub."expiryDate",
        s.name as plan_name, s.price, s.features,
        i.name as institution_name, i.serial_code, i.email as institution_email
       FROM institution_subscriptions isub
       JOIN subscriptions s ON isub."subscriptionId" = s.id
       JOIN institutions i ON isub."institutionId" = i.id
       ORDER BY isub."createdAt" DESC`,
      { type: QueryTypes.SELECT }
    );

    // Add status info
    const now = new Date();
    const enriched = subs.map(sub => {
      const expiry = new Date(sub.expiryDate);
      const isExpired = expiry < now;
      return {
        ...sub,
        is_expired: isExpired,
        days_remaining: Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))),
        status: isExpired ? 'expired' : 'active',
      };
    });

    return res.json({ success: true, subscriptions: enriched, total: enriched.length });
  } catch (err) {
    console.error('Get all subscriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions', success: false });
  }
};

// ─── GET Dashboard Stats ──────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const [stats] = await sequelize.query(
      `SELECT
        (SELECT COUNT(*) FROM institutions) as total_institutions,
        (SELECT COUNT(*) FROM institution_subscriptions) as total_subscriptions,
        (SELECT COUNT(*) FROM subscriptions WHERE status = true) as active_plans,
        (SELECT COUNT(*) FROM institution_subscriptions WHERE "expiryDate" < NOW()) as expired_subscriptions,
        (SELECT COUNT(*) FROM institution_subscriptions WHERE "expiryDate" > NOW()) as active_subscriptions,
        (SELECT COALESCE(SUM(s.price), 0)
         FROM institution_subscriptions isub
         JOIN subscriptions s ON isub."subscriptionId" = s.id
         WHERE isub."expiryDate" > NOW()) as total_revenue
       `,
      { type: QueryTypes.SELECT }
    );

    return res.json({ success: true, stats: stats || {} });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats', success: false });
  }
};

// ─── Health Check ─────────────────────────────────────────────
exports.health = async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'subscription-service', database: 'Connected' });
  } catch (err) {
    res.status(500).json({ status: 'Error', error: err.message });
  }
};

/**
 * Registration Controller — handles hospital/institution self-registration.
 *
 * Flow:
 *   Step 1: POST /register/institution — Creates institution + assigns free trial
 *   Step 2: POST /register/admin — Creates admin account for that institution
 *   GET /register/subscription-plans — Returns available subscription plans
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

const uuidv4 = () => crypto.randomUUID();

// ─── Generate Serial Code ─────────────────────────────────────
function generateSerialCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'TNH-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── Get Available Subscription Plans ─────────────────────────
exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await sequelize.query(
      `SELECT id, name, price, duration, features, status
       FROM subscriptions
       WHERE status = true
       ORDER BY price ASC`,
      { type: QueryTypes.SELECT }
    );
    return res.json({ success: true, plans });
  } catch (err) {
    console.error('Get subscription plans error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
};

// ─── Step 1: Register Institution ─────────────────────────────
exports.registerInstitution = async (req, res) => {
  const {
    name,
    address,
    contact,
    email,
    country,
    region,
    description,
    number_of_employees,
    website,
    emergency_contact,
  } = req.body;

  // Validation
  if (!name || !address || !contact || !email || !country || !region) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['name', 'address', 'contact', 'email', 'country', 'region'],
    });
  }

  // Check if email already exists
  const [existing] = await sequelize.query(
    `SELECT id FROM institutions WHERE LOWER(email) = LOWER(:email)`,
    { replacements: { email }, type: QueryTypes.SELECT }
  );

  if (existing) {
    return res.status(409).json({
      error: 'An institution with this email already exists',
      code: 'INSTITUTION_EXISTS',
    });
  }

  try {
    const institutionId = uuidv4();
    const serialCode = generateSerialCode();

    // Create institution
    await sequelize.query(
      `INSERT INTO institutions (
        id, name, address, contact, email, country, region,
        serial_code, description, number_of_employees, website,
        emergency_contact, "createdAt", "updatedAt"
      ) VALUES (
        :id, :name, :address, :contact, :email, :country, :region,
        :serial_code, :description, :number_of_employees, :website,
        :emergency_contact, NOW(), NOW()
      )`,
      {
        replacements: {
          id: institutionId,
          name,
          address,
          contact,
          email,
          country,
          region,
          serial_code: serialCode,
          description: description || null,
          number_of_employees: number_of_employees || null,
          website: website || null,
          emergency_contact: emergency_contact || null,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Auto-assign free trial subscription
    const [freeTrial] = await sequelize.query(
      `SELECT id FROM subscriptions WHERE name = 'Free Trial' AND status = true LIMIT 1`,
      { type: QueryTypes.SELECT }
    );

    if (freeTrial) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 120); // 4 months

      await sequelize.query(
        `INSERT INTO institution_subscriptions (
          id, "institutionId", "subscriptionId", "startDate", "expiryDate",
          "createdAt", "updatedAt"
        ) VALUES (
          :id, :instId, :subId, NOW(), :expiry, NOW(), NOW()
        )`,
        {
          replacements: {
            id: uuidv4(),
            instId: institutionId,
            subId: freeTrial.id,
            expiry: expiryDate.toISOString(),
          },
          type: QueryTypes.INSERT,
        }
      );

      // Link subscription to institution
      await sequelize.query(
        `UPDATE institutions SET "subscriptionId" = :subId WHERE id = :instId`,
        { replacements: { subId: freeTrial.id, instId: institutionId }, type: QueryTypes.UPDATE }
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Institution registered successfully',
      institution: {
        id: institutionId,
        name,
        serial_code: serialCode,
        email,
      },
    });
  } catch (err) {
    console.error('Register institution error:', err);
    res.status(500).json({ error: 'Failed to register institution' });
  }
};

// ─── Step 2: Register Admin Account ───────────────────────────
exports.registerAdmin = async (req, res) => {
  const {
    institution_id,
    username,
    email,
    password,
    first_name,
    last_name,
    phone,
  } = req.body;

  if (!institution_id || !username || !email || !password) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['institution_id', 'username', 'email', 'password'],
    });
  }

  // Verify institution exists
  const [institution] = await sequelize.query(
    `SELECT id, name FROM institutions WHERE id = :id`,
    { replacements: { id: institution_id }, type: QueryTypes.SELECT }
  );

  if (!institution) {
    return res.status(404).json({ error: 'Institution not found' });
  }

  // Check if admin email already exists
  const [existingAdmin] = await sequelize.query(
    `SELECT id FROM admins WHERE LOWER(email) = LOWER(:email)`,
    { replacements: { email }, type: QueryTypes.SELECT }
  );

  if (existingAdmin) {
    return res.status(409).json({
      error: 'An admin with this email already exists',
      code: 'ADMIN_EXISTS',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    await sequelize.query(
      `INSERT INTO admins (
        id, username, email, password_hash, institution_id, role_manager,
        "createdAt", "updatedAt"
      ) VALUES (
        :id, :username, :email, :password_hash, :institution_id, 'admin',
        NOW(), NOW()
      )`,
      {
        replacements: {
          id: uuidv4(),
          username,
          email,
          password_hash: hashedPassword,
          institution_id,
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        username,
        email,
        institution: institution.name,
      },
    });
  } catch (err) {
    console.error('Register admin error:', err);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
};

// ─── Check Email Availability ─────────────────────────────────
exports.checkEmailAvailability = async (req, res) => {
  const { email, type } = req.query; // type: 'institution' or 'admin'

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let available = true;

    if (type === 'institution') {
      const [existing] = await sequelize.query(
        `SELECT id FROM institutions WHERE LOWER(email) = LOWER(:email)`,
        { replacements: { email }, type: QueryTypes.SELECT }
      );
      available = !existing;
    } else if (type === 'admin') {
      const [existing] = await sequelize.query(
        `SELECT id FROM admins WHERE LOWER(email) = LOWER(:email)`,
        { replacements: { email }, type: QueryTypes.SELECT }
      );
      available = !existing;
    }

    return res.json({ available, email });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Failed to check email availability' });
  }
};

const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

/**
 * Build a nodemailer transporter using SMTP settings from the SystemSetting
 * table. Falls back to environment variables, then to hardcoded defaults.
 */
const createTransporter = async () => {
  let smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass;

  try {
    const SystemSetting = require('../models/SystemSetting');
    const rows = await SystemSetting.findAll({
      where: { category: 'email' },
      raw: true,
    });

    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });

    smtpHost = settings.smtp_host || null;
    smtpPort = parseInt(settings.smtp_port || '0', 10) || null;
    smtpSecure = settings.smtp_secure === 'true' || settings.smtp_secure === true;
    smtpUser = settings.smtp_user || null;
    smtpPass = settings.smtp_password || null;
  } catch (err) {
    // SystemSetting model may not be available yet during migrations
    console.warn('[sendEmail] Could not read SystemSetting, falling back to env:', err.message);
  }

  // Fall back to environment variables
  smtpHost = smtpHost || process.env.SMTP_HOST;
  smtpPort = smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  smtpSecure = smtpSecure || process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  smtpUser = smtpUser || process.env.SMTP_USER;
  smtpPass = smtpPass || process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Ultimate fallback — hardcoded defaults so the system always works out of the box
  return nodemailer.createTransport({
    host: 'mail.brandeviahms.com',
    port: 465,
    secure: true,
    auth: {
      user: 'support@brandeviahms.com',
      pass: 'mU,(kXQ([.UW',
    },
    tls: {
      rejectUnauthorized: true,
    },
    debug: true,
    logger: true,
  });
};

/**
 * Resolve the "from" address from SystemSetting → env → hardcoded default.
 */
const getFromAddress = async () => {
  try {
    const SystemSetting = require('../models/SystemSetting');
    const row = await SystemSetting.findOne({
      where: { key: 'smtp_from' },
      raw: true,
    });
    if (row && row.value) return row.value;
  } catch (_) { /* ignore */ }

  return process.env.SMTP_FROM || process.env.SMTP_USER || 'support@brandeviahms.com';
};

/**
 * Send an email using an EJS template.
 */
const sendEmail = async (to, subject, templateName, context, attachments = []) => {
  const transporter = await createTransporter();
  const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, context);
  const fromAddress = await getFromAddress();

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email sent successfully to ${to}`);
};

/**
 * Send a plain-text / HTML email (no template required).
 * Used by the admin "Send Email" feature.
 */
const sendRawEmail = async (to, subject, htmlBody, fromOverride) => {
  const transporter = await createTransporter();
  const fromAddress = fromOverride || (await getFromAddress());

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html: htmlBody,
  });

  console.log(`Raw email sent successfully to ${to}`);
};

module.exports = sendEmail;
module.exports.sendRawEmail = sendRawEmail;
module.exports.createTransporter = createTransporter;
module.exports.getFromAddress = getFromAddress;

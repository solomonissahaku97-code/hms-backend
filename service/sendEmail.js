const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

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

const transporter = createTransporter();

const sendEmail = async (to, subject, templateName, context, attachments = []) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, context);

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'support@brandeviahms.com';

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      html,
      attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail;

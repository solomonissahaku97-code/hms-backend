const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

// Email configuration using Webmail (update the host, port, and auth details)
const transporter = nodemailer.createTransport({
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
  debug: true, // Enable debug mode for troubleshooting
  logger: true, // Enable logger to log debug information
});

// Function to send email
const sendEmail = async (to, subject, templateName, context, attachments = []) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, context);

    const mailOptions = {
      from: 'support@brandeviahms.com', // Update sender email to match the webmail user
      to,
      subject,
      html,
      attachments, // Attachments parameter passed here
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Throw error to handle it in the calling function
  }
};

module.exports = sendEmail;

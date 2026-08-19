const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const LabResultShareToken = require('../models/LabResultShareToken');
const LabTestResult = require('../models/lab/LabTestResult');
const LabTestTemplate = require('../models/lab/LabTestTemplate');
const LabTestField = require('../models/lab/LabTestField');
const LabInvestigation = require('../models/claims/LabInvestigations');
const Visit = require('../models/Visit');
const Patient = require('../models/patient');
const Institution = require('../models/institution');
const Staff = require('../models/staff');
const { sendSMS } = require('./smsService');
const { Op } = require('sequelize');

const TOKEN_EXPIRY_HOURS = parseInt(process.env.LAB_RESULT_TOKEN_EXPIRY_HOURS || '72', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.tonitel.com';

// ─── Token helpers ──────────────────────────────────────────────

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex token
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Generate or retrieve a share token for a lab result ────────

async function generateShareToken(labResultId, institutionId, staffUserId) {
  // Validate lab result exists and belongs to the institution
  const labResult = await LabTestResult.findByPk(labResultId, {
    include: [
      { model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] },
      { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }, { model: Institution, as: 'institution' }] },
      { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
      { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
    ],
  });

  if (!labResult) {
    throw new Error('Lab result not found');
  }

  if (labResult.institution_id !== institutionId) {
    throw new Error('Unauthorized: lab result does not belong to this institution');
  }

  if (!labResult.visit?.patient) {
    throw new Error('Patient information not found for this lab result');
  }

  // Check for existing non-expired, non-revoked token
  const existingToken = await LabResultShareToken.findOne({
    where: {
      lab_result_id: labResultId,
      institution_id: institutionId,
      expires_at: { [Op.gt]: new Date() },
      revoked_at: null,
    },
  });

  if (existingToken) {
    // Return the raw token is not stored, so we generate a new one
    // But first revoke the old one
    existingToken.revoked_at = new Date();
    await existingToken.save();
  }

  // Generate new token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.substring(0, 8);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const shareToken = await LabResultShareToken.create({
    lab_result_id: labResultId,
    institution_id: institutionId,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    expires_at: expiresAt,
    created_by: staffUserId || null,
  });

  const shareUrl = `${FRONTEND_URL}/lab-results/view/${rawToken}`;

  return {
    token: rawToken,
    shareUrl,
    expiresAt,
    labResult,
    shareToken,
  };
}

// ─── Validate and access a share token ──────────────────────────

async function accessShareToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Invalid token');
  }

  const tokenHash = hashToken(rawToken);

  const shareToken = await LabResultShareToken.findOne({
    where: { token_hash: tokenHash },
    include: [
      { model: LabTestResult, as: 'labResult' },
      { model: Institution, as: 'institution' },
    ],
  });

  if (!shareToken) {
    throw new Error('Invalid or expired link');
  }

  if (shareToken.revoked_at) {
    throw new Error('This link has been revoked');
  }

  if (new Date(shareToken.expires_at) < new Date()) {
    throw new Error('This link has expired');
  }

  // Update access tracking
  shareToken.last_accessed_at = new Date();
  shareToken.access_count = (shareToken.access_count || 0) + 1;
  await shareToken.save();

  // Fetch full lab result with all associations
  const labResult = await LabTestResult.findByPk(shareToken.lab_result_id, {
    include: [
      {
        model: LabTestTemplate,
        as: 'template',
        include: [
          { model: LabTestField, as: 'fields' },
          { model: LabInvestigation, as: 'lab_tarrif' },
        ],
      },
      {
        model: Visit,
        as: 'visit',
        include: [
          { model: Patient, as: 'patient' },
          { model: Institution, as: 'institution' },
        ],
      },
      { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
      { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
    ],
  });

  return {
    labResult,
    institution: shareToken.institution,
    tokenExpiresAt: shareToken.expires_at,
  };
}

// ─── Send lab result SMS ────────────────────────────────────────

async function sendLabResultSMS(labResultId, institutionId, staffUserId, phoneNumber) {
  const { token, shareUrl, labResult } = await generateShareToken(labResultId, institutionId, staffUserId);

  const patient = labResult.visit?.patient;
  if (!patient) {
    throw new Error('Patient information not found');
  }

  const phone = phoneNumber || patient.phone;
  if (!phone) {
    throw new Error('Patient has no phone number on file');
  }

  const institutionName = labResult.visit?.institution?.name || 'Your Hospital';
  const patientName = patient.first_name || 'Patient';

  const message = `Dear ${patientName}, your laboratory results from ${institutionName} are ready. View your results securely here: ${shareUrl}`;

  const smsResult = await sendSMS(phone, message);

  if (!smsResult.success) {
    throw new Error(`SMS failed: ${smsResult.error}`);
  }

  // Mark SMS as sent
  const shareToken = await LabResultShareToken.findOne({
    where: {
      lab_result_id: labResultId,
      token_hash: hashToken(token),
    },
  });

  if (shareToken) {
    shareToken.sms_sent = true;
    shareToken.sms_sent_at = new Date();
    await shareToken.save();
  }

  return {
    success: true,
    shareUrl,
    phone,
    expiresAt: shareToken?.expires_at,
  };
}

// ─── Generate Lab Result PDF ────────────────────────────────────

async function generateLabResultPDF(labResultId, institutionId) {
  const labResult = await LabTestResult.findByPk(labResultId, {
    include: [
      {
        model: LabTestTemplate,
        as: 'template',
        include: [
          { model: LabTestField, as: 'fields' },
          { model: LabInvestigation, as: 'lab_tarrif' },
        ],
      },
      {
        model: Visit,
        as: 'visit',
        include: [
          { model: Patient, as: 'patient' },
          { model: Institution, as: 'institution' },
        ],
      },
      { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
      { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
    ],
  });

  if (!labResult) {
    throw new Error('Lab result not found');
  }

  if (institutionId && labResult.institution_id !== institutionId) {
    throw new Error('Unauthorized: lab result does not belong to this institution');
  }

  const patient = labResult.visit?.patient;
  const institution = labResult.visit?.institution;
  const template = labResult.template;
  const fields = template?.fields || [];
  const values = labResult.values || {};
  const abnormalFlags = labResult.abnormal_flags || [];

  // Create PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Lab Report - ${template?.name || 'Laboratory Report'}`,
      Author: institution?.name || 'Medical Institution',
      Subject: 'Laboratory Test Results',
      CreationDate: new Date(),
    },
  });

  const stream = new PassThrough();
  doc.pipe(stream);

  const pageWidth = doc.page.width - 100; // margins
  const colWidth = pageWidth / 2;

  // ─── HEADER: Institution Info ──────────────────────────
  // Institution name
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a365d');
  doc.text(institution?.name || 'Medical Institution', 50, 40, { width: pageWidth, align: 'center' });

  let headerY = 62;

  // Institution details
  doc.fontSize(8).font('Helvetica').fillColor('#4a5568');
  const instDetails = [];
  if (institution?.address) instDetails.push(institution.address);
  if (institution?.contact) instDetails.push(`Tel: ${institution.contact}`);
  if (institution?.email) instDetails.push(`Email: ${institution.email}`);
  if (institution?.website) instDetails.push(instDetails.length > 0 ? `| ${institution.website}` : institution.website);

  if (instDetails.length > 0) {
    doc.text(instDetails.join('  •  '), 50, headerY, { width: pageWidth, align: 'center' });
    headerY += 12;
  }

  // Divider line
  doc.moveTo(50, headerY + 5).lineTo(50 + pageWidth, headerY + 5).strokeColor('#2b6cb0').lineWidth(2).stroke();
  headerY += 15;

  // Report title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0');
  doc.text('LABORATORY REPORT', 50, headerY, { width: pageWidth, align: 'center' });
  headerY += 20;

  // ─── PATIENT INFO CARD ─────────────────────────────────
  const cardTop = headerY;
  const cardHeight = 55;

  // Card background
  doc.save();
  doc.roundedRect(50, cardTop, pageWidth, cardHeight, 4).fillAndStroke('#f7fafc', '#e2e8f0');
  doc.restore();

  // Patient info
  const patientName = patient
    ? `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim()
    : 'N/A';

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#2d3748');
  doc.text('PATIENT INFORMATION', 60, cardTop + 6, { width: pageWidth - 20 });

  doc.fontSize(8).font('Helvetica').fillColor('#4a5568');
  const leftCol = 60;
  const rightCol = 320;

  let infoY = cardTop + 20;
  doc.text(`Name: ${patientName}`, leftCol, infoY);
  doc.text(`Date: ${formatDate(labResult.createdAt)}`, rightCol, infoY);
  infoY += 12;

  if (patient?.folder_number) {
    doc.text(`Folder #: ${patient.folder_number}`, leftCol, infoY);
  }
  if (patient?.gender) {
    doc.text(`Sex: ${patient.gender === 'M' ? 'Male' : 'Female'}`, rightCol, infoY);
  }
  infoY += 12;

  if (patient?.date_of_birth) {
    doc.text(`DOB: ${formatDate(patient.date_of_birth)}`, leftCol, infoY);
  }
  if (labResult.visit_id) {
    doc.text(`Visit Ref: ${labResult.visit_id.substring(0, 8).toUpperCase()}`, rightCol, infoY);
  }

  headerY = cardTop + cardHeight + 15;

  // ─── TEST INFO ─────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
  doc.text('Test Details', 50, headerY);
  headerY += 14;

  doc.fontSize(8).font('Helvetica').fillColor('#4a5568');
  const testDetails = [];
  if (template?.name) testDetails.push(`Test: ${template.name}`);
  if (template?.lab_tarrif?.test_description) testDetails.push(`Investigation: ${template.lab_tarrif.test_description}`);
  if (labResult.specimen_type) testDetails.push(`Specimen: ${labResult.specimen_type}`);
  if (labResult.status) testDetails.push(`Status: ${labResult.status.toUpperCase()}`);

  testDetails.forEach((detail) => {
    doc.text(detail, 60, headerY, { width: pageWidth - 20 });
    headerY += 11;
  });

  headerY += 5;

  // ─── RESULTS TABLE ─────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
  doc.text('Results', 50, headerY);
  headerY += 16;

  // Table header
  const tableLeft = 50;
  const colParams = 160;
  const colResult = 100;
  const colRefRange = 110;
  const colUnit = 60;
  const colStatus = 70;

  // Header row background
  doc.save();
  doc.rect(tableLeft, headerY - 2, pageWidth, 16).fill('#edf2f7');
  doc.restore();

  doc.fontSize(7).font('Helvetica-Bold').fillColor('#2d3748');
  doc.text('PARAMETER', tableLeft + 4, headerY + 2, { width: colParams });
  doc.text('RESULT', tableLeft + colParams + 4, headerY + 2, { width: colResult });
  doc.text('REFERENCE RANGE', tableLeft + colParams + colResult + 4, headerY + 2, { width: colRefRange });
  doc.text('UNIT', tableLeft + colParams + colResult + colRefRange + 4, headerY + 2, { width: colUnit });
  doc.text('STATUS', tableLeft + colParams + colResult + colRefRange + colUnit + 4, headerY + 2, { width: colStatus });

  headerY += 18;

  // Table rows
  const abnormalParams = new Set((abnormalFlags || []).map(f => f.parameter?.toLowerCase()));

  fields.forEach((field, index) => {
    const param = field.label || field.name || `Field ${index + 1}`;
    const value = values[param] || values[field.label] || values[field.name] || '—';
    const refRange = field.reference_range || field.options?.reference_range || '—';
    const unit = field.unit || field.options?.unit || '—';
    const isAbnormal = abnormalParams.has(param.toLowerCase()) || abnormalParams.has((field.label || '').toLowerCase());

    // Alternating row background
    if (index % 2 === 0) {
      doc.save();
      doc.rect(tableLeft, headerY - 2, pageWidth, 14).fill('#fafafa');
      doc.restore();
    }

    // Row border
    doc.save();
    doc.moveTo(tableLeft, headerY + 12).lineTo(tableLeft + pageWidth, headerY + 12).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.restore();

    doc.fontSize(8).font('Helvetica').fillColor('#2d3748');
    doc.text(param, tableLeft + 4, headerY, { width: colParams });

    // Value - highlight abnormal
    if (isAbnormal) {
      doc.font('Helvetica-Bold').fillColor('#c53030');
    } else {
      doc.font('Helvetica').fillColor('#2d3748');
    }
    doc.text(String(value), tableLeft + colParams + 4, headerY, { width: colResult });

    doc.font('Helvetica').fillColor('#718096');
    doc.text(String(refRange), tableLeft + colParams + colResult + 4, headerY, { width: colRefRange });
    doc.text(String(unit), tableLeft + colParams + colResult + colRefRange + 4, headerY, { width: colUnit });

    // Status
    if (isAbnormal) {
      doc.font('Helvetica-Bold').fillColor('#c53030');
      doc.text('Abnormal', tableLeft + colParams + colResult + colRefRange + colUnit + 4, headerY, { width: colStatus });
    } else {
      doc.font('Helvetica').fillColor('#276749');
      doc.text('Normal', tableLeft + colParams + colResult + colRefRange + colUnit + 4, headerY, { width: colStatus });
    }

    headerY += 16;
  });

  // If no fields, show values directly
  if (fields.length === 0 && values && typeof values === 'object') {
    Object.entries(values).forEach(([key, val], index) => {
      const isAbnormal = abnormalParams.has(key.toLowerCase());

      if (index % 2 === 0) {
        doc.save();
        doc.rect(tableLeft, headerY - 2, pageWidth, 14).fill('#fafafa');
        doc.restore();
      }

      doc.save();
      doc.moveTo(tableLeft, headerY + 12).lineTo(tableLeft + pageWidth, headerY + 12).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.restore();

      doc.fontSize(8).font('Helvetica').fillColor('#2d3748');
      doc.text(key, tableLeft + 4, headerY, { width: colParams });

      if (isAbnormal) {
        doc.font('Helvetica-Bold').fillColor('#c53030');
      }
      doc.text(String(val), tableLeft + colParams + 4, headerY, { width: colResult });

      headerY += 16;
    });
  }

  headerY += 10;

  // ─── NOTES ─────────────────────────────────────────────
  if (labResult.notes || labResult.technician_notes || labResult.request_notes) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
    doc.text('Notes', 50, headerY);
    headerY += 14;

    doc.fontSize(8).font('Helvetica').fillColor('#4a5568');
    if (labResult.request_notes) {
      doc.text(`Request Notes: ${labResult.request_notes}`, 60, headerY, { width: pageWidth - 20 });
      headerY += 12;
    }
    if (labResult.technician_notes) {
      doc.text(`Technician Notes: ${labResult.technician_notes}`, 60, headerY, { width: pageWidth - 20 });
      headerY += 12;
    }
    if (labResult.notes) {
      doc.text(`Comments: ${labResult.notes}`, 60, headerY, { width: pageWidth - 20 });
      headerY += 12;
    }
    headerY += 5;
  }

  // ─── SIGNATURES ────────────────────────────────────────
  headerY += 10;
  if (headerY > doc.page.height - 120) {
    doc.addPage();
    headerY = 50;
  }

  const sigY = headerY;
  doc.fontSize(8).font('Helvetica').fillColor('#4a5568');

  // Requested by
  doc.text('Requested by:', 60, sigY);
  if (labResult.creator) {
    doc.font('Helvetica-Bold').fillColor('#2d3748');
    doc.text(`${labResult.creator.firstName || ''} ${labResult.creator.lastName || ''}`.trim() || 'N/A', 60, sigY + 12);
  }

  // Verified by
  doc.font('Helvetica').fillColor('#4a5568');
  doc.text('Verified by:', 300, sigY);
  if (labResult.verifier) {
    doc.font('Helvetica-Bold').fillColor('#2d3748');
    doc.text(`${labResult.verifier.firstName || ''} ${labResult.verifier.lastName || ''}`.trim() || 'N/A', 300, sigY + 12);
  }

  headerY = sigY + 35;

  // ─── FOOTER ────────────────────────────────────────────
  if (headerY > doc.page.height - 80) {
    doc.addPage();
    headerY = 50;
  }

  // Footer divider
  doc.moveTo(50, headerY).lineTo(50 + pageWidth, headerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  headerY += 8;

  doc.fontSize(7).font('Helvetica').fillColor('#a0aec0');
  doc.text('This report is electronically generated.', 50, headerY, { width: pageWidth, align: 'center' });
  headerY += 10;

  const reportRef = labResult.sample_number || labResult.id.substring(0, 8).toUpperCase();
  doc.text(
    `${institution?.name || 'Medical Institution'}  •  Report Ref: ${reportRef}  •  Generated: ${formatDateTime(new Date())}`,
    50,
    headerY,
    { width: pageWidth, align: 'center' }
  );

  doc.end();

  return stream;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = {
  generateShareToken,
  accessShareToken,
  sendLabResultSMS,
  generateLabResultPDF,
};

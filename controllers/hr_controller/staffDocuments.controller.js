const { Op } = require('sequelize');
const DocumentsAndLicenses = require('../../models/hr/staffDocuments');

// GET /staff-documents/staff/:staffId
const getDocumentsByStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    if (!staffId) return res.status(400).json({ message: 'staffId is required' });

    const documents = await DocumentsAndLicenses.findAll({
      where: { staff: staffId },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ data: documents });
  } catch (error) {
    return next(error);
  }
};

// POST /staff-documents
// Body: institution_id, staff, document_name, document_type, optional fields incl. file_url
const createDocument = async (req, res, next) => {
  try {
    const {
      institution_id,
      staff,
      document_name,
      document_type,
      document_number,
      issuing_authority,
      issue_date,
      expiry_date,
      file_url,
      status,
      remarks,
    } = req.body;

    if (!institution_id || !staff || !document_name || !document_type) {
      return res.status(400).json({
        message: 'institution_id, staff, document_name, document_type are required',
      });
    }

    const created = await DocumentsAndLicenses.create({
      institution_id,
      staff,
      document_name,
      document_type,
      document_number: document_number ?? null,
      issuing_authority: issuing_authority ?? null,
      issue_date: issue_date ?? null,
      expiry_date: expiry_date ?? null,
      file_url: file_url ?? null,
      status: status ?? undefined,
      remarks: remarks ?? null,
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    return next(error);
  }
};

// PATCH /staff-documents/:id/status
const updateDocumentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) return res.status(400).json({ message: 'id is required' });
    if (!status) return res.status(400).json({ message: 'status is required' });

    const [updatedCount] = await DocumentsAndLicenses.update(
      { status },
      { where: { id } }
    );

    if (!updatedCount) return res.status(404).json({ message: 'Document not found' });

    const updated = await DocumentsAndLicenses.findByPk(id);
    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
};

// PUT /staff-documents/:id
const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required' });

    const {
      institution_id,
      staff,
      document_name,
      document_type,
      document_number,
      issuing_authority,
      issue_date,
      expiry_date,
      file_url,
      status,
      remarks,
    } = req.body;

    const doc = await DocumentsAndLicenses.findByPk(id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    await doc.update({
      institution_id: institution_id ?? doc.institution_id,
      staff: staff ?? doc.staff,
      document_name: document_name ?? doc.document_name,
      document_type: document_type ?? doc.document_type,
      document_number: document_number ?? doc.document_number,
      issuing_authority: issuing_authority ?? doc.issuing_authority,
      issue_date: issue_date ?? doc.issue_date,
      expiry_date: expiry_date ?? doc.expiry_date,
      file_url: file_url ?? doc.file_url,
      // Allow status to be updated here too (optional)
      status: status ?? doc.status,
      remarks: remarks ?? doc.remarks,
    });

    return res.status(200).json({ data: doc });
  } catch (error) {
    return next(error);
  }
};

// DELETE /staff-documents/:id
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required' });

    const deletedCount = await DocumentsAndLicenses.destroy({ where: { id } });

    if (!deletedCount) return res.status(404).json({ message: 'Document not found' });

    return res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDocumentsByStaff,
  createDocument,
  updateDocumentStatus,
  updateDocument,
  deleteDocument,
};


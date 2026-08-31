const sequelize = require('../config/database');

/**
 * Central Patient Network Controller
 * 
 * Manages:
 * - Central patient identity (cross-institution)
 * - Patient-institution relationships
 * - Patient transfers between institutions
 * - Patient referrals between institutions
 * - Cross-institution lab referrals
 * - Shared clinical records
 * - Cross-institution audit trail
 */

// ═══════════════════════════════════════════════════════════════
//  CENTRAL PATIENT IDENTITY
// ═══════════════════════════════════════════════════════════════

/**
 * POST /central-patients — Register a new central patient identity
 */
exports.createCentralPatient = async (req, res) => {
  try {
    const {
      first_name, middle_name, last_name, date_of_birth, gender,
      phone, email, address, city, region, country, blood_group,
      national_id, ghana_card_number, has_insurance, insurance_provider, nhis_number
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'first_name and last_name are required' });
    }

    // Check for duplicate: same name + DOB + phone
    const dupQuery = `
      SELECT id, central_patient_number, first_name, last_name 
      FROM central_patients 
      WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
      ${date_of_birth ? 'AND date_of_birth = $3' : 'AND date_of_birth IS NULL'}
      ${phone ? `AND phone = $${date_of_birth ? 4 : 3}` : ''}
      AND is_active = true
      LIMIT 1
    `;
    const params = [first_name, last_name];
    if (date_of_birth) params.push(date_of_birth);
    if (phone) params.push(phone);
    
    const [existing] = await sequelize.query(dupQuery, { bind: params });
    
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Potential duplicate patient found',
        existing_patient: existing[0]
      });
    }

    // Generate central patient number
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) as cnt FROM central_patients'
    );
    const seq = parseInt(countResult[0].cnt) + 1;
    const central_patient_number = `CPN-${String(seq).padStart(6, '0')}`;

    const [result] = await sequelize.query(`
      INSERT INTO central_patients (
        central_patient_number, first_name, middle_name, last_name,
        date_of_birth, gender, phone, email, address, city, region, country,
        blood_group, national_id, ghana_card_number, has_insurance,
        insurance_provider, nhis_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, {
      bind: [central_patient_number, first_name, middle_name || null, last_name,
        date_of_birth || null, gender || null, phone || null, email || null,
        address || null, city || null, region || null, country || null,
        blood_group || null, national_id || null, ghana_card_number || null,
        has_insurance || false, insurance_provider || null, nhis_number || null]
    });

    res.status(201).json({ success: true, patient: result[0] });
  } catch (error) {
    console.error('Create central patient error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /central-patients/search — Search central patients across the network
 */
exports.searchCentralPatients = async (req, res) => {
  try {
    const { q, name, patient_number, phone, nhis_number, national_id, ghana_card_number, limit = 20 } = req.query;

    let whereClauses = ['is_active = true'];
    let params = [];
    let paramIdx = 1;

    if (q) {
      whereClauses.push(`(LOWER(first_name) LIKE LOWER($${paramIdx}) OR LOWER(last_name) LIKE LOWER($${paramIdx}) OR central_patient_number = $${paramIdx+1})`);
      params.push(`%${q}%`, q);
      paramIdx += 2;
    }
    if (patient_number) {
      whereClauses.push(`central_patient_number = $${paramIdx}`);
      params.push(patient_number);
      paramIdx++;
    }
    if (name) {
      whereClauses.push(`(LOWER(first_name) LIKE LOWER($${paramIdx}) OR LOWER(last_name) LIKE LOWER($${paramIdx}))`);
      params.push(`%${name}%`);
      paramIdx++;
    }
    if (phone) {
      whereClauses.push(`phone = $${paramIdx}`);
      params.push(phone);
      paramIdx++;
    }
    if (nhis_number) {
      whereClauses.push(`nhis_number = $${paramIdx}`);
      params.push(nhis_number);
      paramIdx++;
    }
    if (national_id) {
      whereClauses.push(`national_id = $${paramIdx}`);
      params.push(national_id);
      paramIdx++;
    }
    if (ghana_card_number) {
      whereClauses.push(`ghana_card_number = $${paramIdx}`);
      params.push(ghana_card_number);
      paramIdx++;
    }

    const whereStr = whereClauses.join(' AND ');
    const [centralPatients] = await sequelize.query(`
      SELECT cp.*, 
        (SELECT json_agg(json_build_object(
          'institution_id', pir.institution_id,
          'institution_name', i.name,
          'relationship_type', pir.relationship_type,
          'status', pir.status,
          'total_encounters', pir.total_encounters,
          'last_visit_date', pir.last_visit_date
        )) FROM patient_institution_relationships pir 
        LEFT JOIN institutions i ON pir.institution_id = i.id
        WHERE pir.central_patient_id = cp.id) as institution_relationships
      FROM central_patients cp
      WHERE ${whereStr}
      ORDER BY cp.created_at DESC
      LIMIT $${paramIdx}
    `, { bind: [...params, parseInt(limit)] });

    // Also search the local patients table
    let localWhereClauses = [];
    let localParams = [];
    let localParamIdx = 1;

    if (q) {
      localWhereClauses.push(`(LOWER(first_name) LIKE LOWER($${localParamIdx}) OR LOWER(last_name) LIKE LOWER($${localParamIdx}) OR folder_number = $${localParamIdx+1})`);
      localParams.push(`%${q}%`, q);
      localParamIdx += 2;
    }
    if (name) {
      localWhereClauses.push(`(LOWER(first_name) LIKE LOWER($${localParamIdx}) OR LOWER(last_name) LIKE LOWER($${localParamIdx}))`);
      localParams.push(`%${name}%`);
      localParamIdx++;
    }
    if (phone) {
      localWhereClauses.push(`phone_number = $${localParamIdx}`);
      localParams.push(phone);
      localParamIdx++;
    }
    if (nhis_number) {
      localWhereClauses.push(`nhis_number = $${localParamIdx}`);
      localParams.push(nhis_number);
      localParamIdx++;
    }

    let localPatients = [];
    if (localWhereClauses.length > 0) {
      const localWhereStr = localWhereClauses.join(' AND ');
      const [rows] = await sequelize.query(`
        SELECT p.*, 'local' as source,
          i.name as institution_name
        FROM patients p
        LEFT JOIN institutions i ON p.institution_id = i.id
        WHERE ${localWhereStr}
        ORDER BY p.created_at DESC
        LIMIT $${localParamIdx}
      `, { bind: [...localParams, parseInt(limit)] });
      localPatients = rows;
    }

    // Merge: central patients first, then local patients not already in central
    const centralIds = new Set(centralPatients.map(p => p.id));
    const uniqueLocal = localPatients.filter(p => !centralIds.has(p.id));

    // Convert local patients to match central format
    const mergedLocal = uniqueLocal.map(p => ({
      id: p.id,
      central_patient_number: p.folder_number || null,
      first_name: p.first_name,
      middle_name: p.middle_name || null,
      last_name: p.last_name,
      date_of_birth: p.date_of_birth || null,
      gender: p.gender || null,
      phone: p.phone_number || null,
      email: p.email || null,
      address: p.address || null,
      city: null,
      region: null,
      country: p.country || null,
      blood_group: p.blood_group || null,
      national_id: null,
      ghana_card_number: null,
      has_insurance: p.has_insurance || false,
      insurance_provider: p.insurance_provider || null,
      nhis_number: p.nhis_number || null,
      is_active: true,
      source: 'local',
      institution_relationships: p.institution_name ? [{
        institution_id: p.institution_id,
        institution_name: p.institution_name,
        status: 'active',
        relationship_type: 'registered'
      }] : []
    }));

    const allPatients = [...centralPatients, ...mergedLocal];

    res.json({ success: true, patients: allPatients, count: allPatients.length });
  } catch (error) {
    console.error('Search central patients error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /central-patients/:id — Get a central patient with all institution relationships
 */
exports.getCentralPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const [patients] = await sequelize.query(`
      SELECT * FROM central_patients WHERE id = $1
    `, { bind: [id] });

    if (patients.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Get institution relationships
    const [relationships] = await sequelize.query(`
      SELECT pir.*, i.name as institution_name, i.serial_code as institution_code
      FROM patient_institution_relationships pir
      JOIN institutions i ON pir.institution_id = i.id
      WHERE pir.central_patient_id = $1
      ORDER BY pir.created_at DESC
    `, { bind: [id] });

    // Get active transfers
    const [transfers] = await sequelize.query(`
      SELECT pt.*, 
        si.name as sending_institution_name,
        ri.name as receiving_institution_name
      FROM patient_transfers pt
      JOIN institutions si ON pt.sending_institution_id = si.id
      JOIN institutions ri ON pt.receiving_institution_id = ri.id
      WHERE pt.central_patient_id = $1
      ORDER BY pt.created_at DESC
      LIMIT 10
    `, { bind: [id] });

    res.json({
      success: true,
      patient: patients[0],
      institution_relationships: relationships,
      recent_transfers: transfers
    });
  } catch (error) {
    console.error('Get central patient error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PATIENT-INSTITUTION RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /relationships — Link a central patient to an institution
 */
exports.createRelationship = async (req, res) => {
  try {
    const { central_patient_id, institution_id, institution_patient_id, relationship_type = 'registered' } = req.body;
    const actor_institution_id = req.user?.institution_id;

    if (!central_patient_id || !institution_id) {
      return res.status(400).json({ success: false, message: 'central_patient_id and institution_id are required' });
    }

    // Check if relationship already exists
    const [existing] = await sequelize.query(`
      SELECT id FROM patient_institution_relationships 
      WHERE central_patient_id = $1 AND institution_id = $2
    `, { bind: [central_patient_id, institution_id] });

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Relationship already exists', relationship_id: existing[0].id });
    }

    const [result] = await sequelize.query(`
      INSERT INTO patient_institution_relationships (
        central_patient_id, institution_id, institution_patient_id, relationship_type, status
      ) VALUES ($1,$2,$3,$4,'active')
      RETURNING *
    `, { bind: [central_patient_id, institution_id, institution_patient_id || null, relationship_type] });

    // Audit trail
    await auditLog(actor_institution_id, req.user?.id, 'relationship_created', 'patient_institution_relationship', result[0].id, null, institution_id, { relationship_type });

    res.status(201).json({ success: true, relationship: result[0] });
  } catch (error) {
    console.error('Create relationship error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /relationships/institution/:institutionId — Get all patients for an institution
 */
exports.getInstitutionPatients = async (req, res) => {
  try {
    const { institutionId } = req.params;
    const actor_institution_id = req.user?.institution_id;

    // Enforce institution isolation: can only see own institution's patients
    if (actor_institution_id && actor_institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Access denied: cannot view other institution patients' });
    }

    const [patients] = await sequelize.query(`
      SELECT cp.id, cp.central_patient_number, cp.first_name, cp.last_name, 
             cp.date_of_birth, cp.gender, cp.phone, cp.has_insurance,
             pir.relationship_type, pir.status as relationship_status,
             pir.total_encounters, pir.last_visit_date
      FROM central_patients cp
      JOIN patient_institution_relationships pir ON cp.id = pir.central_patient_id
      WHERE pir.institution_id = $1 AND cp.is_active = true
      ORDER BY pir.last_visit_date DESC NULLS LAST
    `, { bind: [institutionId] });

    res.json({ success: true, patients, count: patients.length });
  } catch (error) {
    console.error('Get institution patients error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PATIENT TRANSFERS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /transfers — Create a patient transfer
 */
exports.createTransfer = async (req, res) => {
  try {
    const {
      central_patient_id, receiving_institution_id, reason,
      clinical_summary, diagnosis, relevant_medications,
      relevant_lab_results, relevant_documents, transfer_notes, priority
    } = req.body;
    const sending_institution_id = req.user?.institution_id;

    if (!central_patient_id || !receiving_institution_id || !reason) {
      return res.status(400).json({ success: false, message: 'central_patient_id, receiving_institution_id, and reason are required' });
    }

    if (sending_institution_id === receiving_institution_id) {
      return res.status(400).json({ success: false, message: 'Cannot transfer to the same institution' });
    }

    // Verify sender has a relationship with this patient
    const [rel] = await sequelize.query(`
      SELECT id FROM patient_institution_relationships 
      WHERE central_patient_id = $1 AND institution_id = $2 AND status = 'active'
    `, { bind: [central_patient_id, sending_institution_id] });

    if (rel.length === 0) {
      return res.status(403).json({ success: false, message: 'No active relationship with this patient at your institution' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO patient_transfers (
        central_patient_id, sending_institution_id, receiving_institution_id,
        referred_by, reason, clinical_summary, diagnosis,
        relevant_medications, relevant_lab_results, relevant_documents,
        transfer_notes, priority, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING *
    `, {
      bind: [central_patient_id, sending_institution_id, receiving_institution_id,
        req.user?.id || null, reason, clinical_summary || null, diagnosis || null,
        JSON.stringify(relevant_medications || []),
        JSON.stringify(relevant_lab_results || []),
        JSON.stringify(relevant_documents || []),
        transfer_notes || null, priority || 'normal']
    });

    // Audit
    await auditLog(sending_institution_id, req.user?.id, 'transfer_created', 'patient_transfer', result[0].id, sending_institution_id, receiving_institution_id, { reason });

    res.status(201).json({ success: true, transfer: result[0] });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /transfers/:id/accept — Accept a patient transfer
 */
exports.acceptTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const receiving_institution_id = req.user?.institution_id;

    const [transfers] = await sequelize.query(
      'SELECT * FROM patient_transfers WHERE id = $1', { bind: [id] }
    );
    if (transfers.length === 0) return res.status(404).json({ success: false, message: 'Transfer not found' });

    const transfer = transfers[0];
    if (transfer.receiving_institution_id !== receiving_institution_id) {
      return res.status(403).json({ success: false, message: 'This transfer is not for your institution' });
    }
    if (transfer.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot accept transfer in status: ${transfer.status}` });
    }

    await sequelize.query(`
      UPDATE patient_transfers SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, { bind: [id] });

    // Create/update relationship at receiving institution
    await sequelize.query(`
      INSERT INTO patient_institution_relationships (central_patient_id, institution_id, relationship_type, status)
      VALUES ($1, $2, 'transferred', 'active')
      ON CONFLICT (central_patient_id, institution_id) DO UPDATE SET
        status = 'active', updated_at = NOW()
    `, { bind: [transfer.central_patient_id, receiving_institution_id] });

    // Share the transfer clinical data
    await sequelize.query(`
      INSERT INTO shared_clinical_records (
        central_patient_id, source_institution_id, target_institution_id,
        record_type, record_id, record_data, shared_by, shared_via
      ) VALUES ($1,$2,$3,'transfer',$4,$5,$6,'transfer')
    `, {
      bind: [transfer.central_patient_id, transfer.sending_institution_id, receiving_institution_id,
        id, JSON.stringify({
          clinical_summary: transfer.clinical_summary,
          diagnosis: transfer.diagnosis,
          medications: transfer.relevant_medications,
          lab_results: transfer.relevant_lab_results,
          documents: transfer.relevant_documents
        }), req.user?.id]
    });

    await auditLog(receiving_institution_id, req.user?.id, 'transfer_accepted', 'patient_transfer', id, transfer.sending_institution_id, receiving_institution_id, {});

    res.json({ success: true, message: 'Transfer accepted' });
  } catch (error) {
    console.error('Accept transfer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /transfers/:id/reject — Reject a patient transfer
 */
exports.rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const receiving_institution_id = req.user?.institution_id;

    const [transfers] = await sequelize.query(
      'SELECT * FROM patient_transfers WHERE id = $1', { bind: [id] }
    );
    if (transfers.length === 0) return res.status(404).json({ success: false, message: 'Transfer not found' });

    const transfer = transfers[0];
    if (transfer.receiving_institution_id !== receiving_institution_id) {
      return res.status(403).json({ success: false, message: 'This transfer is not for your institution' });
    }

    await sequelize.query(`
      UPDATE patient_transfers SET status = 'rejected', rejected_at = NOW(), 
        rejection_reason = $2, updated_at = NOW() WHERE id = $1
    `, { bind: [id, rejection_reason || null] });

    await auditLog(receiving_institution_id, req.user?.id, 'transfer_rejected', 'patient_transfer', id, transfer.sending_institution_id, receiving_institution_id, { rejection_reason });

    res.json({ success: true, message: 'Transfer rejected' });
  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /transfers/incoming — Get incoming transfers for this institution
 */
exports.getIncomingTransfers = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const { status } = req.query;

    let where = 'pt.receiving_institution_id = $1';
    const params = [institution_id];
    if (status) { where += ` AND pt.status = $2`; params.push(status); }

    const [transfers] = await sequelize.query(`
      SELECT pt.*, cp.central_patient_number, cp.first_name, cp.last_name,
        si.name as sending_institution_name
      FROM patient_transfers pt
      JOIN central_patients cp ON pt.central_patient_id = cp.id
      JOIN institutions si ON pt.sending_institution_id = si.id
      WHERE ${where}
      ORDER BY pt.created_at DESC
    `, { bind: params });

    res.json({ success: true, transfers });
  } catch (error) {
    console.error('Get incoming transfers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /transfers/outgoing — Get outgoing transfers from this institution
 */
exports.getOutgoingTransfers = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const { status } = req.query;

    let where = 'pt.sending_institution_id = $1';
    const params = [institution_id];
    if (status) { where += ` AND pt.status = $2`; params.push(status); }

    const [transfers] = await sequelize.query(`
      SELECT pt.*, cp.central_patient_number, cp.first_name, cp.last_name,
        ri.name as receiving_institution_name
      FROM patient_transfers pt
      JOIN central_patients cp ON pt.central_patient_id = cp.id
      JOIN institutions ri ON pt.receiving_institution_id = ri.id
      WHERE ${where}
      ORDER BY pt.created_at DESC
    `, { bind: params });

    res.json({ success: true, transfers });
  } catch (error) {
    console.error('Get outgoing transfers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PATIENT REFERRALS
// ═══════════════════════════════════════════════════════════════

exports.createReferral = async (req, res) => {
  try {
    const {
      central_patient_id, receiving_institution_id, referral_type,
      reason, clinical_summary, diagnosis, relevant_medications,
      relevant_lab_results, relevant_documents, referral_notes, priority
    } = req.body;
    const referring_institution_id = req.user?.institution_id;

    if (!central_patient_id || !reason) {
      return res.status(400).json({ success: false, message: 'central_patient_id and reason are required' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO patient_referrals (
        central_patient_id, referring_institution_id, receiving_institution_id,
        referring_clinician, referral_type, reason, clinical_summary, diagnosis,
        relevant_medications, relevant_lab_results, relevant_documents,
        referral_notes, priority, status, sent_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      RETURNING *
    `, {
      bind: [central_patient_id, referring_institution_id, receiving_institution_id || null,
        req.user?.id || null, referral_type || 'general', reason,
        clinical_summary || null, diagnosis || null,
        JSON.stringify(relevant_medications || []),
        JSON.stringify(relevant_lab_results || []),
        JSON.stringify(relevant_documents || []),
        referral_notes || null, priority || 'normal',
        receiving_institution_id ? 'sent' : 'draft']
    });

    await auditLog(referring_institution_id, req.user?.id, 'referral_created', 'patient_referral', result[0].id, referring_institution_id, receiving_institution_id, { reason });

    res.status(201).json({ success: true, referral: result[0] });
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.acceptReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const receiving_institution_id = req.user?.institution_id;

    const [referrals] = await sequelize.query(
      'SELECT * FROM patient_referrals WHERE id = $1', { bind: [id] }
    );
    if (referrals.length === 0) return res.status(404).json({ success: false, message: 'Referral not found' });

    const referral = referrals[0];
    if (referral.receiving_institution_id !== receiving_institution_id) {
      return res.status(403).json({ success: false, message: 'This referral is not for your institution' });
    }

    await sequelize.query(`
      UPDATE patient_referrals SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, { bind: [id] });

    // Create relationship + share clinical data
    await sequelize.query(`
      INSERT INTO patient_institution_relationships (central_patient_id, institution_id, relationship_type, status)
      VALUES ($1, $2, 'referred', 'active')
      ON CONFLICT (central_patient_id, institution_id) DO UPDATE SET status = 'active', updated_at = NOW()
    `, { bind: [referral.central_patient_id, receiving_institution_id] });

    await auditLog(receiving_institution_id, req.user?.id, 'referral_accepted', 'patient_referral', id, referral.referring_institution_id, receiving_institution_id, {});

    res.json({ success: true, message: 'Referral accepted' });
  } catch (error) {
    console.error('Accept referral error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const receiving_institution_id = req.user?.institution_id;

    await sequelize.query(`
      UPDATE patient_referrals SET status = 'rejected', rejected_at = NOW(),
        rejection_reason = $2, updated_at = NOW() WHERE id = $1
    `, { bind: [id, rejection_reason || null] });

    await auditLog(receiving_institution_id, req.user?.id, 'referral_rejected', 'patient_referral', id, null, receiving_institution_id, { rejection_reason });

    res.json({ success: true, message: 'Referral rejected' });
  } catch (error) {
    console.error('Reject referral error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getIncomingReferrals = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const [referrals] = await sequelize.query(`
      SELECT pr.*, cp.central_patient_number, cp.first_name, cp.last_name,
        ri.name as referring_institution_name
      FROM patient_referrals pr
      JOIN central_patients cp ON pr.central_patient_id = cp.id
      JOIN institutions ri ON pr.referring_institution_id = ri.id
      WHERE pr.receiving_institution_id = $1
      ORDER BY pr.created_at DESC
    `, { bind: [institution_id] });
    res.json({ success: true, referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOutgoingReferrals = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const [referrals] = await sequelize.query(`
      SELECT pr.*, cp.central_patient_number, cp.first_name, cp.last_name,
        reci.name as receiving_institution_name
      FROM patient_referrals pr
      JOIN central_patients cp ON pr.central_patient_id = cp.id
      LEFT JOIN institutions reci ON pr.receiving_institution_id = reci.id
      WHERE pr.referring_institution_id = $1
      ORDER BY pr.created_at DESC
    `, { bind: [institution_id] });
    res.json({ success: true, referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  CROSS-INSTITUTION LAB REFERRALS
// ═══════════════════════════════════════════════════════════════

exports.createLabReferral = async (req, res) => {
  try {
    const {
      central_patient_id, performing_institution_id, test_names,
      clinical_indication, specimen_type, priority
    } = req.body;
    const referring_institution_id = req.user?.institution_id;

    if (!central_patient_id || !performing_institution_id || !test_names || !test_names.length) {
      return res.status(400).json({ success: false, message: 'central_patient_id, performing_institution_id, and test_names are required' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO lab_referrals_cross (
        central_patient_id, referring_institution_id, performing_institution_id,
        referring_clinician, test_names, clinical_indication, specimen_type, priority, status, sent_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',NOW())
      RETURNING *
    `, {
      bind: [central_patient_id, referring_institution_id, performing_institution_id,
        req.user?.id || null, JSON.stringify(test_names),
        clinical_indication || null, specimen_type || null, priority || 'routine']
    });

    await auditLog(referring_institution_id, req.user?.id, 'lab_referral_created', 'lab_referral_cross', result[0].id, referring_institution_id, performing_institution_id, { test_names });

    res.status(201).json({ success: true, lab_referral: result[0] });
  } catch (error) {
    console.error('Create lab referral error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.acceptLabReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const performing_institution_id = req.user?.institution_id;

    const [refs] = await sequelize.query('SELECT * FROM lab_referrals_cross WHERE id = $1', { bind: [id] });
    if (refs.length === 0) return res.status(404).json({ success: false, message: 'Lab referral not found' });

    const ref = refs[0];
    if (ref.performing_institution_id !== performing_institution_id) {
      return res.status(403).json({ success: false, message: 'This lab referral is not for your institution' });
    }

    await sequelize.query(`
      UPDATE lab_referrals_cross SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, { bind: [id] });

    await auditLog(performing_institution_id, req.user?.id, 'lab_referral_accepted', 'lab_referral_cross', id, ref.referring_institution_id, performing_institution_id, {});

    res.json({ success: true, message: 'Lab referral accepted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeLabReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { result_data, result_notes } = req.body;
    const performing_institution_id = req.user?.institution_id;

    await sequelize.query(`
      UPDATE lab_referrals_cross SET status = 'completed', completed_at = NOW(),
        result_data = $2, result_notes = $3, updated_at = NOW()
      WHERE id = $1
    `, { bind: [id, JSON.stringify(result_data || {}), result_notes || null] });

    await auditLog(performing_institution_id, req.user?.id, 'lab_referral_completed', 'lab_referral_cross', id, null, performing_institution_id, {});

    res.json({ success: true, message: 'Lab referral completed with results' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getIncomingLabReferrals = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const [refs] = await sequelize.query(`
      SELECT lrc.*, cp.central_patient_number, cp.first_name, cp.last_name,
        ri.name as referring_institution_name
      FROM lab_referrals_cross lrc
      JOIN central_patients cp ON lrc.central_patient_id = cp.id
      JOIN institutions ri ON lrc.referring_institution_id = ri.id
      WHERE lrc.performing_institution_id = $1
      ORDER BY lrc.created_at DESC
    `, { bind: [institution_id] });
    res.json({ success: true, lab_referrals: refs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOutgoingLabReferrals = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const [refs] = await sequelize.query(`
      SELECT lrc.*, cp.central_patient_number, cp.first_name, cp.last_name,
        pi.name as performing_institution_name
      FROM lab_referrals_cross lrc
      JOIN central_patients cp ON lrc.central_patient_id = cp.id
      LEFT JOIN institutions pi ON lrc.performing_institution_id = pi.id
      WHERE lrc.referring_institution_id = $1
      ORDER BY lrc.created_at DESC
    `, { bind: [institution_id] });
    res.json({ success: true, lab_referrals: refs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  SHARED CLINICAL RECORDS
// ═══════════════════════════════════════════════════════════════

exports.getSharedRecords = async (req, res) => {
  try {
    const institution_id = req.user?.institution_id;
    const { central_patient_id } = req.query;

    let where = 'target_institution_id = $1 AND is_active = true';
    const params = [institution_id];
    if (central_patient_id) { where += ` AND central_patient_id = $2`; params.push(central_patient_id); }

    const [records] = await sequelize.query(`
      SELECT scr.*, si.name as source_institution_name
      FROM shared_clinical_records scr
      JOIN institutions si ON scr.source_institution_id = si.id
      WHERE ${where}
      ORDER BY scr.created_at DESC
    `, { bind: params });

    res.json({ success: true, shared_records: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.shareRecord = async (req, res) => {
  try {
    const {
      central_patient_id, target_institution_id, record_type, record_id, record_data
    } = req.body;
    const source_institution_id = req.user?.institution_id;

    const [result] = await sequelize.query(`
      INSERT INTO shared_clinical_records (
        central_patient_id, source_institution_id, target_institution_id,
        record_type, record_id, record_data, shared_by, shared_via
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'manual')
      RETURNING *
    `, {
      bind: [central_patient_id, source_institution_id, target_institution_id,
        record_type, record_id || null, JSON.stringify(record_data || {}),
        req.user?.id]
    });

    await auditLog(source_institution_id, req.user?.id, 'record_shared', 'shared_clinical_record', result[0].id, source_institution_id, target_institution_id, { record_type });

    res.status(201).json({ success: true, shared_record: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════

exports.getAuditTrail = async (req, res) => {
  try {
    const { central_patient_id, institution_id, action, limit = 50 } = req.query;

    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (central_patient_id) { whereClauses.push(`central_patient_id = $${idx}`); params.push(central_patient_id); idx++; }
    if (institution_id) { whereClauses.push(`(actor_institution_id = $${idx} OR source_institution_id = $${idx} OR target_institution_id = $${idx})`); params.push(institution_id); idx++; }
    if (action) { whereClauses.push(`action = $${idx}`); params.push(action); idx++; }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const [logs] = await sequelize.query(`
      SELECT ci.*, 
        si.name as source_institution_name,
        ti.name as target_institution_name
      FROM cross_institution_audit_trail ci
      LEFT JOIN institutions si ON ci.source_institution_id = si.id
      LEFT JOIN institutions ti ON ci.target_institution_id = ti.id
      ${whereStr}
      ORDER BY ci.created_at DESC
      LIMIT $${idx}
    `, { bind: [...params, parseInt(limit)] });

    res.json({ success: true, audit_trail: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  ACCESS CONTROL CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * GET /access-check — Check if institution can access patient's clinical data
 */
exports.checkAccess = async (req, res) => {
  try {
    const { central_patient_id, record_type } = req.query;
    const institution_id = req.user?.institution_id;

    // Check active relationship
    const [rel] = await sequelize.query(`
      SELECT status FROM patient_institution_relationships 
      WHERE central_patient_id = $1 AND institution_id = $2
    `, { bind: [central_patient_id, institution_id] });

    if (rel.length > 0 && rel[0].status === 'active') {
      await auditLog(institution_id, req.user?.id, 'access_check_granted', record_type || 'unknown', null, null, institution_id, { central_patient_id });
      return res.json({ success: true, access: true, reason: 'active_relationship' });
    }

    // Check shared records
    const [shared] = await sequelize.query(`
      SELECT id FROM shared_clinical_records 
      WHERE central_patient_id = $1 AND target_institution_id = $2 AND is_active = true
      ${record_type ? 'AND record_type = $3' : ''}
    `, { bind: record_type ? [central_patient_id, institution_id, record_type] : [central_patient_id, institution_id] });

    if (shared.length > 0) {
      await auditLog(institution_id, req.user?.id, 'access_check_granted', record_type || 'unknown', null, null, institution_id, { central_patient_id });
      return res.json({ success: true, access: true, reason: 'shared_record' });
    }

    await auditLog(institution_id, req.user?.id, 'access_check_denied', record_type || 'unknown', null, null, institution_id, { central_patient_id });
    res.json({ success: true, access: false, reason: 'no_relationship_or_sharing' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  STATISTICS
// ═══════════════════════════════════════════════════════════════

exports.getStats = async (req, res) => {
  try {
    const [stats] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM central_patients WHERE is_active = true) as total_patients,
        (SELECT COUNT(*) FROM patient_transfers WHERE status = 'pending') as pending_transfers,
        (SELECT COUNT(*) FROM patient_referrals WHERE status = 'sent') as pending_referrals,
        (SELECT COUNT(*) FROM lab_referrals_cross WHERE status IN ('sent','accepted')) as active_lab_referrals,
        (SELECT COUNT(*) FROM shared_clinical_records WHERE is_active = true) as shared_records,
        (SELECT COUNT(*) FROM cross_institution_audit_trail WHERE created_at > NOW() - INTERVAL '24 hours') as audit_entries_24h
    `);

    res.json({ success: true, stats: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  HELPER: Audit Log
// ═══════════════════════════════════════════════════════════════

async function auditLog(actor_institution_id, actor_user_id, action, resource_type, resource_id, source_institution_id, target_institution_id, details) {
  try {
    await sequelize.query(`
      INSERT INTO cross_institution_audit_trail (
        actor_institution_id, actor_user_id, action, resource_type,
        resource_id, source_institution_id, target_institution_id, details
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, {
      bind: [actor_institution_id || null, actor_user_id || null, action,
        resource_type || null, resource_id || null,
        source_institution_id || null, target_institution_id || null,
        JSON.stringify(details || {})]
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

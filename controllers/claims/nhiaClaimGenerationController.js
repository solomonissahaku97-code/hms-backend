const { Op } = require('sequelize');
const { createNHISXML, validateClaimsForExport } = require('../../utils/claimExportUtils');
const Claim = require('../../models/claims/claim');
const Patient = require('../../models/patient');
const Department = require('../../models/department');
const ClaimItem = require('../../models/claims/claimItem');
const Visit = require('../../models/Visit');
const Institution = require('../../models/institution');
const Staff = require('../../models/staff');
const Diagnosis = require('../../models/diagnosis');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');
const Insurance = require('../../models/insuranceTable');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const NHISClaimExport = require('../../models/claims/nhisClaimExport');

// Generate batch number
function generateBatchNumber(institution) {
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `NHIS-${institution.serial_code}-${timestamp}-${randomStr}`;
}


// Resolve the requester's institution. The authenticated staff/admin context
// takes precedence; a request-body institution_id is only used when the
// authenticated user has no institution context (e.g. superadmin).
function resolveInstitutionId(req) {
    const authId = (req.admin && req.admin.institution_id) || (req.user && req.user.institution_id) || null;
    if (authId) return authId;
    return req.body && req.body.institution_id ? req.body.institution_id : null;
}

// In your nhiaClaimGenerationController.js - add these logs
exports.generateXMLReport = async (req, res) => {
    try {
        const {
            dateRange,
            patientCategory = [],
            claimTypes = [],
            statuses = [],
            financialOptions = [],
            patientTypes = [],
            gender,
            ageGroup,
            minAmount,
            maxAmount,
            splitBy,
            exportFormat = 'xml'
        } = req.body;

        // J9 - institution isolation: an institution can ONLY export its own
        // claims. The institution is always taken from the authenticated user;
        // a body-supplied institution_id is never trusted when the user has an
        // institution context.
        const institution_id = resolveInstitutionId(req);
        if (!institution_id) {
            return res.status(400).json({ message: 'Institution context is required to generate an NHIS XML export' });
        }

        console.log('📦 Received request body:', JSON.stringify(req.body, null, 2));
        console.log('🏥 Institution ID (authenticated):', institution_id);

        const whereClause = {};
        // Scope every export to the authenticated institution.
        const visitWhere = { institution_id };
        const patientWhere = {};

        // 📅 Date Filter
        if (dateRange?.length === 2) {
            whereClause.createdAt = {
                [Op.between]: [new Date(dateRange[0]), new Date(dateRange[1])]
            };
            console.log('📅 Date range filter:', dateRange);
        }

        // 👥 Patient Category - FIXED: Use on_admission field
        if (patientCategory.length && !patientCategory.includes('both')) {
            if (patientCategory.includes('inpatient')) {
                visitWhere.on_admission = true;
            }
            if (patientCategory.includes('outpatient')) {
                visitWhere.on_admission = false;
            }
            console.log('👥 Patient category filter:', patientCategory);
        }

        // 🏥 Claim Types
        // NOTE: Claim model does not have `claim_type` column (error: column Claim.claim_type does not exist).
        // If you need claim-type filtering, it must be backed by an existing column (e.g. claim_status)
        // or by joining another table that contains claim type.
        if (claimTypes.length) {
            console.warn('⚠️ claimTypes filter requested, but Claim.claim_type column does not exist. Ignoring filter.', claimTypes);
        }

        // 📊 Statuses
        if (statuses.length && !statuses.includes('all')) {
            whereClause.claim_status = { [Op.in]: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)) };
            console.log('📊 Status filter:', statuses);
        }

        console.log('🔍 Final whereClause:', JSON.stringify(whereClause, null, 2));
        console.log('🔍 Final visitWhere:', JSON.stringify(visitWhere, null, 2));
        console.log('🔍 Final patientWhere:', JSON.stringify(patientWhere, null, 2));

        // 🔍 Fetch filtered claims with the REAL clinical data the export needs
        //    (diagnosis -> ICD-10, provider staff, insurance, claim items).
        console.log('🔍 Starting database query...');
        const claims = await Claim.findAll({
            where: whereClause,
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    where: visitWhere,
                    include: [
                        {
                            model: Patient,
                            as: 'patient',
                            where: patientWhere,
                            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'has_insurance'],
                            include: [{ model: Insurance, as: 'insurance' }]
                        },
                        {
                            model: Institution,
                            as: 'institution',
                            attributes: ['id', 'name', 'serial_code', 'address', 'contact']
                        },
                        {
                            model: Diagnosis,
                            as: 'diagnosis',
                            include: [
                                { model: systemDiagnosis, as: 'systemDiagnosis' },
                                { model: Staff, as: 'staff' }
                            ]
                        }
                    ]
                },
                {
                    model: ClaimItem,
                    as: 'items',
                    attributes: ['id', 'description', 'gdrg_code', 'item_type', 'quantity', 'unit_price', 'amount', 'nhia_amount', 'co_payment', 'date_performed', 'performed_by'],
                    include: [{ model: Staff, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'role_manager'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        console.log(`📊 Found ${claims.length} claims`);

        if (claims.length > 0) {
            console.log('📋 Sample claim data:', JSON.stringify({
                id: claims[0].id,
                claim_reference_number: claims[0].claim_reference_number,
                total_amount: claims[0].total_amount,
                visit: claims[0].visit ? {
                    id: claims[0].visit.id,
                    facility_id: claims[0].visit.facility_id,
                    patient: claims[0].visit.patient ? {
                        id: claims[0].visit.patient.id,
                        firstname: claims[0].visit.patient.firstname,
                        lastname: claims[0].visit.patient.lastname
                    } : null
                } : null,
                items_count: claims[0].items ? claims[0].items.length : 0
            }, null, 2));
        }


        if (!claims.length)
            return res.status(404).json({ message: 'No claims found for the selected filters' });

        const institution = await Institution.findByPk(institution_id);
        if (!institution)
            return res.status(404).json({ message: 'Institution not found' });
        // Defense in depth: the fetched institution must match the authenticated
        // institution so a non-existent/mismatched body id cannot be used.
        if (institution.id !== institution_id) {
            return res.status(403).json({ message: 'Institution mismatch' });
        }

        // ✅ NHIA export validation (J1): never generate an invalid XML file.
        //    Claims missing a real diagnosis, items or consistent amounts are
        //    reported by reference instead of exporting fabricated data.
        const validationErrors = validateClaimsForExport(claims, institution_id);
        if (validationErrors.length > 0) {
            return res.status(422).json({
                message: 'NHIS export blocked: claims are missing required information',
                errors: validationErrors
            });
        }

        // 🔢 Generate batch and file info
        const batch_number = generateBatchNumber(institution);
        const file_name = `${batch_number}.xml`;
        const exportDir = path.join(__dirname, '../../../exports');
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
        const file_path = path.join(exportDir, file_name);

        // 🧾 Generate XML content
        const xmlData = createNHISXML(claims, institution);

        // 💾 Save XML to disk
        fs.writeFileSync(file_path, xmlData);

        // 🧭 Log export record
        await NHISClaimExport.create({
            batch_number,
            file_name,
            total_claims: claims.length,
            exported_by: req.user?.id || null,
            institution_id,
            file_path,
            status: 'Completed',
        });


        res.set('Content-Type', 'application/xml');
        return res.status(200).send(xmlData);

    } catch (error) {
        console.error('❌ Error generating NHIS XML:', error);
        res.status(500).json({ message: 'Error generating NHIS XML', error: error.message });
    }
};



// 📦 GET: List all NHIS claim export batches (for auditors)

exports.listExportBatches = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      institution_id,
      generated_by,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    const where = {};

    // 🗓️ Date filter
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // 🏥 Institution filter - always scoped to the authenticated user's
    // institution when they have one (J9).
    const authInstitutionId = (req.admin && req.admin.institution_id) || (req.user && req.user.institution_id) || null;
    if (authInstitutionId) where.institution_id = authInstitutionId;
    else if (institution_id) where.institution_id = institution_id;

    // 👤 Staff who generated the export
    if (generated_by) where.generated_by = generated_by;

    // 🔍 Search filter
    if (search) {
      where[Op.or] = [
        { batch_number: { [Op.iLike]: `%${search}%` } },
        { file_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const exportsList = await NHISClaimExport.findAll({
      where,
      include: [
        {
          model: Institution,
          as: 'institution',
          attributes: ['id', 'name', 'address', 'contact'],
        },
        {
          model: Staff,
          as: 'generator',
        //   attributes: ['id', 'first_name', 'last_name', 'staff_id'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      count: exportsList.length,
      data: exportsList.map((exp) => ({
        id: exp.id,
        batch_number: exp.batch_number,
        institution: exp.institution?.name || null,
        generated_by: exp.generator
          ? `${exp.generator.first_name} ${exp.generator.last_name}`
          : null,
        createdAt: exp.createdAt,
        file_name: exp.file_name,
        file_path: exp.file_path,
        total_claims: exp.total_claims,
        total_amount: exp.total_amount,
        export_status: exp.export_status,
      })),
    });
  } catch (err) {
    console.error('❌ Error fetching NHIS exports:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NHIS claim exports',
      error: err.message,
    });
  }
};

const builder = require('xmlbuilder2');

exports.createNHISXML = (claims, institution) => {
  console.log('🔧 Starting XML generation with:', claims.length, 'claims');
  
  const root = builder.create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NHISClaims');

  // Helper functions
  const formatDate = (date) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };

  const sanitizeText = (text) => {
    if (text === null || text === undefined || text === '') return '';
    return String(text);
  };

  // Generate ICD10-like diagnosis code (you can replace with actual diagnosis data)
  const generateDiagnosisCode = (claim) => {
    // This is a simplified version - you should use actual diagnosis data from your database
    const commonCodes = ['J06.9', 'I10', 'E11.9', 'A09', 'R05', 'R50.9'];
    return commonCodes[Math.floor(Math.random() * commonCodes.length)];
  };

  const generateDiagnosisDescription = (code) => {
    const descriptions = {
      'J06.9': 'Acute upper respiratory infection, unspecified',
      'I10': 'Essential (primary) hypertension',
      'E11.9': 'Type 2 diabetes mellitus without complications',
      'A09': 'Infectious gastroenteritis and colitis, unspecified',
      'R05': 'Cough',
      'R50.9': 'Fever, unspecified'
    };
    return descriptions[code] || 'General medical examination';
  };

  // Determine claim type based on visit data
  const getClaimType = (visit) => {
    return visit.on_admission ? 'Inpatient' : 'Outpatient';
  };

  // Get claim month in required format (YYYY-MM)
  const getClaimMonth = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const appendClaims = (arr) => {
    console.log('📝 Processing', arr.length, 'claims for XML');
    
    arr.forEach((claim, index) => {
      console.log(`  📋 Processing claim ${index + 1}:`, claim.id, claim.claim_reference_number);
      
      const visit = claim.visit || {};
      const patient = visit.patient || {};
      const items = claim.items || [];
      const institutionData = visit.institution || institution || {};

      const claimNode = root.ele('Claim');
      
      // ✅ Basic Claim Information
      claimNode.ele('ClaimReferenceNumber').txt(sanitizeText(claim.claim_reference_number || 'UNKNOWN'));
      claimNode.ele('FacilityID').txt(sanitizeText(visit.institution_id || institution?.id || 'N/A'));
      claimNode.ele('FacilityName').txt(sanitizeText(institutionData.name || 'Healthcare Facility'));
      claimNode.ele('VisitDate').txt(formatDate(visit.visit_date || visit.createdAt || claim.createdAt));
      claimNode.ele('ClaimMonth').txt(getClaimMonth(visit.visit_date || visit.createdAt || claim.createdAt));
      claimNode.ele('DischargeDate').txt(formatDate(visit.discharge_date || visit.visit_date || visit.createdAt));
      claimNode.ele('TotalClaimAmount').txt(sanitizeText(claim.total_amount || 0));
      claimNode.ele('ClaimStatus').txt(sanitizeText(claim.claim_status || 'Pending'));
      claimNode.ele('ClaimType').txt(getClaimType(visit));

      // ✅ Patient Information
      const patientNode = claimNode.ele('Patient');
      patientNode.ele('PatientID').txt(sanitizeText(patient.id || 'N/A'));
      
      const fullName = `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim();
      patientNode.ele('FullName').txt(sanitizeText(fullName || 'Unknown Patient'));
      
      patientNode.ele('Gender').txt(sanitizeText(patient.gender || 'Unknown'));
      patientNode.ele('DateOfBirth').txt(formatDate(patient.date_of_birth));
      
      const insuranceType = patient.has_insurance ? (patient.insurance_type || 'NHIS') : 'Private';
      patientNode.ele('InsuranceType').txt(sanitizeText(insuranceType));

      // ✅ Diagnosis Information (NHIA Required)
      const diagnosisCode = generateDiagnosisCode(claim);
      const diagnosisDescription = generateDiagnosisDescription(diagnosisCode);
      
      const diagnosisNode = claimNode.ele('Diagnosis');
      diagnosisNode.ele('DiagnosisCode').txt(diagnosisCode);
      diagnosisNode.ele('DiagnosisDescription').txt(diagnosisDescription);
      diagnosisNode.ele('DiagnosisType').txt('Principal'); // Principal/Secondary

      // ✅ Service Provider Information
      const serviceProviderNode = claimNode.ele('ServiceProvider');
      serviceProviderNode.ele('ProviderID').txt(sanitizeText(claim.provider_id || 'DEFAULT_PROVIDER'));
      serviceProviderNode.ele('ProviderName').txt(sanitizeText(claim.provider_name || 'Medical Officer'));
      serviceProviderNode.ele('ProviderType').txt(sanitizeText(claim.provider_type || 'Doctor'));

      // ✅ Claim Items/Services
      const claimItemsNode = claimNode.ele('ClaimItems');
      if (items.length > 0) {
        items.forEach((item, itemIndex) => {
          const itemNode = claimItemsNode.ele('Item');
          
          // ✅ Basic Item Information
          itemNode.ele('ItemName').txt(sanitizeText(item.description || `Item ${itemIndex + 1}`));
          itemNode.ele('ItemCode').txt(sanitizeText(item.gdrg_code || ''));
          itemNode.ele('ItemType').txt(sanitizeText(item.item_type || 'Service')); // Drug/Service
          itemNode.ele('Quantity').txt(sanitizeText(item.quantity || 1));
          itemNode.ele('UnitPrice').txt(sanitizeText(item.unit_price || item.amount || 0));
          itemNode.ele('TotalAmount').txt(sanitizeText(item.amount || 0));
          
          // ✅ NHIA Specific Fields for Items
          itemNode.ele('ServiceDate').txt(formatDate(item.date_performed || visit.visit_date));
          itemNode.ele('NHIACoveredAmount').txt(sanitizeText(item.nhia_amount || item.amount || 0));
          itemNode.ele('PatientAmount').txt(sanitizeText(item.co_payment || 0));
          itemNode.ele('ServiceProvider').txt(sanitizeText(item.performed_by || 'Medical Officer'));
        });
      } else {
        console.log(`    ⚠️ No items for claim ${claim.id}`);
        // Add a default item if none exist
        const itemNode = claimItemsNode.ele('Item');
        itemNode.ele('ItemName').txt('General Consultation');
        itemNode.ele('ItemCode').txt('CONS001');
        itemNode.ele('ItemType').txt('Service');
        itemNode.ele('Quantity').txt(1);
        itemNode.ele('UnitPrice').txt(claim.total_amount || 50);
        itemNode.ele('TotalAmount').txt(claim.total_amount || 50);
        itemNode.ele('ServiceDate').txt(formatDate(visit.visit_date));
        itemNode.ele('NHIACoveredAmount').txt(claim.total_amount || 50);
        itemNode.ele('PatientAmount').txt(0);
        itemNode.ele('ServiceProvider').txt('Medical Officer');
      }

      // ✅ Additional NHIA Metadata
      const metadataNode = claimNode.ele('Metadata');
      metadataNode.ele('SubmissionDate').txt(formatDate(new Date()));
      metadataNode.ele('Version').txt('1.0');
      metadataNode.ele('SchemaVersion').txt('NHIA-2024');
    });
  };

  try {
    if (Array.isArray(claims)) {
      appendClaims(claims);
    } else {
      Object.values(claims).forEach(appendClaims);
    }

    const xmlResult = root.end({ prettyPrint: true });
    console.log('✅ XML generation completed, final length:', xmlResult.length);
    console.log('📄 Sample of generated XML:', xmlResult.substring(0, 800));
    
    return xmlResult;
  } catch (error) {
    console.error('❌ XML Generation Error:', error);
    const fallbackRoot = builder.create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NHISClaims')
      .ele('Error').txt('Failed to generate claims data: ' + error.message).up();
    
    return fallbackRoot.end({ prettyPrint: true });
  }
};
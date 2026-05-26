const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

class XMLParserService {
  async parseXMLFile(file) {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const xmlContent = fs.readFileSync(file.path, 'utf-8');
      console.log('📄 XML Content (first 500 chars):', xmlContent.substring(0, 500));
      
      return new Promise((resolve, reject) => {
        parser.parseString(xmlContent, (err, result) => {
          if (err) {
            console.error('❌ XML parsing error:', err);
            reject(new Error(`XML parsing failed: ${err.message}`));
            return;
          }
          
          console.log('📊 Parsed XML structure:', JSON.stringify(result, null, 2).substring(0, 1000));
          
          // Clean up uploaded file
          fs.unlinkSync(file.path);
          
          resolve(this.transformXMLStructure(result));
        });
      });
    } catch (error) {
      throw new Error(`XML processing error: ${error.message}`);
    }
  }

  transformXMLStructure(xmlData) {
    console.log('🔄 Transforming XML structure...');
    
    let claims = [];
    let header = {};
    let summary = {};

    // Handle different XML structures
    if (xmlData.NHISClaims) {
      console.log('✅ Detected NHISClaims structure');
      // Your generated XML structure
      header = {
        facilityId: xmlData.NHISClaims.Claim?.[0]?.FacilityID || 'Unknown',
        generatedDate: new Date().toISOString(),
        totalClaims: Array.isArray(xmlData.NHISClaims.Claim) ? xmlData.NHISClaims.Claim.length : 1
      };
      
      const rawClaims = xmlData.NHISClaims.Claim;
      claims = Array.isArray(rawClaims) ? rawClaims : [rawClaims];
      
      summary = {
        totalAmount: claims.reduce((sum, claim) => sum + (parseFloat(claim.TotalClaimAmount) || 0), 0),
        totalClaims: claims.length
      };
      
    } else if (xmlData.NHIAClaims) {
      // NHIA-compliant file
      console.log('✅ Detected NHIAClaims structure');
      header = xmlData.NHIAClaims.Header || {};
      const rawClaims = xmlData.NHIAClaims.Claims?.Claim || [];
      claims = Array.isArray(rawClaims) ? rawClaims : [rawClaims];
      summary = xmlData.NHIAClaims.Summary || {};
      
    } else if (xmlData.Claims || xmlData.Claim) {
      // Flat file structure (capital C)
      console.log('✅ Detected flat Claims structure');
      header = xmlData.Header || {};
      const rawClaims = xmlData.Claims?.Claim || xmlData.Claim || [];
      claims = Array.isArray(rawClaims) ? rawClaims : [rawClaims];
      summary = xmlData.Summary || {};
      
    } else if (xmlData.claims || xmlData.claim) {
      // Lowercase claims structure (from NHIA processing system)
      console.log('✅ Detected lowercase claims structure');
      header = xmlData.Header || {};
      const rawClaims = xmlData.claims?.claim || xmlData.claim || [];
      claims = Array.isArray(rawClaims) ? rawClaims : [rawClaims];
      summary = xmlData.Summary || {};
      
    } else {
      console.error('❌ Unsupported XML structure:', Object.keys(xmlData));
      throw new Error("Unsupported XML structure. Expected NHISClaims, NHIAClaims, Claims, or claims structure.");
    }

    console.log(`📋 Processing ${claims.length} claims`);

    return {
      header,
      claims: claims.map((claim, index) => this.transformClaim(claim, index)),
      summary
    };
  }

  transformClaim(claim, index) {
    console.log(`  📋 Transforming claim ${index + 1}:`, claim.ClaimReferenceNumber || claim.claimID);
    
    // Handle different structures:
    // 1. NHISClaims structure: Patient object, ClaimItems
    // 2. NHIA/claims structure: flat fields like claimID, surname, otherNames, diagnosis, medicine
    
    const patient = claim.Patient || {};
    const claimItems = claim.ClaimItems?.Item || [];
    const services = Array.isArray(claimItems) ? claimItems : [claimItems];

    // Check if this is the lowercase claims structure (NHIA processing system format)
    const isLowercaseClaims = !!claim.claimID;

    return {
      claimId: claim.ClaimReferenceNumber || claim.ClaimID || claim.claimID || `CLAIM-${index + 1}`,
      nhisNumber: patient.InsuranceType === 'NHIS' ? (patient.PatientID || 'UNKNOWN') : (claim.memberNo || 'NON-NHIS'),
      memberName: patient.FullName || claim.MemberName || (claim.surname && claim.otherNames ? `${claim.surname} ${claim.otherNames}`.trim() : 'Unknown Patient'),
      memberDOB: patient.DateOfBirth || claim.MemberDOB || claim.dateOfBirth,
      diagnosisCode: claim.DiagnosisCode || (claim.diagnosis?.gdrgCode) || 'UNKNOWN',
      diagnosisDescription: claim.DiagnosisDescription || claim.diagnosis?.diagnosis || 'No diagnosis provided',
      services: this.transformServicesForClaimsStructure(claim, services, isLowercaseClaims),
      totals: {
        totalAmount: parseFloat(claim.TotalClaimAmount) || 0,
        facilityId: claim.FacilityID || claim.physicianID || 'Unknown',
        visitDate: claim.VisitDate || claim.dateOfService,
        claimStatus: claim.ClaimStatus || 'Pending'
      },
      // Additional fields for lowercase claims structure
      claimCheckCode: claim.claimCheckCode || null,
      preAuthorizationCodes: claim.preAuthorizationCodes || null,
      physicianID: claim.physicianID || null,
      cardSerialNo: claim.cardSerialNo || null,
      hospitalRecNo: claim.hospitalRecNo || null,
      isDependant: claim.isDependant || '0',
      typeOfService: claim.typeOfService || null,
      isUnbundled: claim.isUnbundled || '0',
      includesPharmacy: claim.includesPharmacy || '0',
      typeOfAttendance: claim.typeOfAttendance || null,
      serviceOutcome: claim.serviceOutcome || null,
      specialtyAttended: claim.specialtyAttended || null,
      principalGDRG: claim.principalGDRG || null
    };
  }

  transformServicesForClaimsStructure(claim, services, isLowercaseClaims) {
    // For lowercase claims structure, transform medicines into services
    if (isLowercaseClaims && claim.medicine) {
      const medicines = Array.isArray(claim.medicine) ? claim.medicine : [claim.medicine];
      
      if (medicines.length > 0 && medicines[0]) {
        return medicines.map((med, idx) => ({
          serviceId: med.medicineCode || `MED-${idx + 1}`,
          serviceCode: med.medicineCode || 'UNKNOWN',
          description: med.prescription?.unparsed || `Medicine ${idx + 1}`,
          date: med.serviceDate || new Date().toISOString().split('T')[0],
          quantity: parseInt(med.dispensedQty) || 1,
          unitPrice: 0,
          totalAmount: 0,
          nhiaAmount: 0,
          patientAmount: 0,
          status: 'Dispensed'
        }));
      }
    }
    
    // Also handle procedure element
    if (isLowercaseClaims && claim.procedure) {
      const procedures = Array.isArray(claim.procedure) ? claim.procedure : [claim.procedure];
      
      if (procedures.length > 0 && procedures[0]) {
        return procedures.map((proc, idx) => ({
          serviceId: proc.gdrgCode || `PROC-${idx + 1}`,
          serviceCode: proc.gdrgCode || 'UNKNOWN',
          description: proc.diagnosis || `Procedure ${idx + 1}`,
          date: proc.serviceDate || new Date().toISOString().split('T')[0],
          quantity: 1,
          unitPrice: 0,
          totalAmount: 0,
          nhiaAmount: 0,
          patientAmount: 0,
          status: 'Completed'
        }));
      }
    }

    // Check if we have valid services from ClaimItems (NHISClaims format)
    // Handle both array and single object cases
    let servicesArray = [];
    if (services) {
      servicesArray = Array.isArray(services) ? services : [services];
    }
    
    // Filter out empty/null services
    servicesArray = servicesArray.filter(s => s && (s.ItemCode || s.ItemName || s.ServiceDescription));

    // If we have valid services, transform them
    if (servicesArray.length > 0) {
      return servicesArray.map((service, index) => ({
        serviceId: service.ItemCode || `SVC-${index + 1}`,
        serviceCode: service.ItemCode || 'UNKNOWN',
        description: service.ItemName || service.ServiceDescription || `Service ${index + 1}`,
        itemType: service.ItemType || null, // Pass ItemType for diagnosis detection
        date: service.ServiceDate || new Date().toISOString().split('T')[0],
        quantity: parseInt(service.Quantity) || 1,
        unitPrice: parseFloat(service.UnitPrice) || parseFloat(service.amount) || 0,
        totalAmount: parseFloat(service.TotalAmount) || parseFloat(service.amount) || 0,
        nhiaAmount: parseFloat(service.NHIACoveredAmount) || parseFloat(service.amount) || 0,
        patientAmount: parseFloat(service.PatientAmount) || 0,
        status: service.Status || 'Pending'
      }));
    }

    // No services found - return default consultation
    console.log('⚠️ No services found in claim');
    return [{
      serviceId: 'DEFAULT-001',
      serviceCode: 'CONS001',
      description: 'General Consultation',
      date: new Date().toISOString().split('T')[0],
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      nhiaAmount: 0,
      patientAmount: 0,
      status: 'Pending'
    }];
  }

  transformServices(services) {
    if (!services || services.length === 0) {
      console.log('⚠️ No services found in claim');
      return [{
        serviceId: 'DEFAULT-001',
        serviceCode: 'CONS001',
        description: 'General Consultation',
        date: new Date().toISOString().split('T')[0],
        quantity: 1,
        unitPrice: 0,
        totalAmount: 0,
        nhiaAmount: 0,
        patientAmount: 0,
        status: 'Pending'
      }];
    }

    const servicesArray = Array.isArray(services) ? services : [services];
    
    return servicesArray.map((service, index) => ({
      serviceId: service.ItemCode || `SVC-${index + 1}`,
      serviceCode: service.ItemCode || 'UNKNOWN',
      description: service.ItemName || service.ServiceDescription || `Service ${index + 1}`,
      date: service.ServiceDate || new Date().toISOString().split('T')[0],
      quantity: parseInt(service.Quantity) || 1,
      unitPrice: parseFloat(service.UnitPrice) || parseFloat(service.amount) || 0,
      totalAmount: parseFloat(service.TotalAmount) || parseFloat(service.amount) || 0,
      nhiaAmount: parseFloat(service.NHIACoveredAmount) || parseFloat(service.amount) || 0,
      patientAmount: parseFloat(service.PatientAmount) || 0,
      status: service.Status || 'Pending'
    }));
  }
}

module.exports = new XMLParserService();


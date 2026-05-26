

const { Op } = require('sequelize');
const GDRGCode = require("../models/claims/GDRGCode");
const LabInvestigation = require("../models/claims/LabInvestigations");
const Medicine = require("../models/claims/medication");
const systemDiagnosis = require("../models/claims/systemDiagnosis");
const NHIAMapping = require("../models/vetting/NHIAMapping");



class DatabaseMapperService {
  async mapToDatabase(xmlData) {
    const mappedClaims = [];
    
    for (const claim of xmlData.claims) {
      const mappedClaim = {
        ...claim,
        diagnosis: await this.mapDiagnosis(claim.diagnosisCode),
        services: await Promise.all(
          claim.services.map(service => this.mapService(service))
        )
      };
      
      mappedClaims.push(mappedClaim);
    }
    
    return {
      header: xmlData.header,
      claims: mappedClaims,
      summary: xmlData.summary
    };
  }

  async mapDiagnosis(icd10Code) {
    try {
      // First try to find in NHIA mappings
      const nhiaMapping = await NHIAMapping.findOne({
        where: { 
          nhiaCode: icd10Code.trim().toUpperCase(),
          entityType: 'diagnosis',
          isActive: true 
        },
        include: [{ model: SystemDiagnosis, as: 'diagnosis' }]
      });
      
      if (nhiaMapping && nhiaMapping.diagnosis) {
        return {
          originalCode: icd10Code,
          mappedDiagnosis: nhiaMapping.diagnosis,
          mapping: nhiaMapping,
          status: 'mapped_via_nhia',
          isValid: true
        };
      }
      
      // Fallback: Direct lookup in system_diagnosis
      const diagnosis = await systemDiagnosis.findOne({ 
        where: { icd_10_code: icd10Code.trim().toUpperCase() } 
      });
      
      return {
        originalCode: icd10Code,
        mappedDiagnosis: diagnosis,
        mapping: null,
        status: diagnosis ? 'mapped_direct' : 'not_found',
        isValid: !!diagnosis
      };
      
    } catch (error) {
      return {
        originalCode: icd10Code,
        status: 'error',
        isValid: false,
        error: error.message
      };
    }
  }

  async mapService(service) {
    const serviceCode = service.serviceCode.trim().toUpperCase();
    
    try {
      // First try NHIA mapping table - include diagnosis for ICD-10 codes
      const nhiaMapping = await NHIAMapping.findOne({
        where: { 
          nhiaCode: serviceCode,
          isActive: true 
        },
        include: [
          { model: Medicine, as: 'medicine' },
          { model: GDRGCode, as: 'procedure' },
          { model: LabInvestigation, as: 'labTest' },
          { model: systemDiagnosis, as: 'diagnosis' }
        ]
      });
      
      if (nhiaMapping) {
        return this.mapViaNHIAMapping(service, nhiaMapping);
      }
      
      // Fallback: Direct database lookup
      return await this.mapViaDirectLookup(service, serviceCode);
      
    } catch (error) {
      return {
        ...service,
        type: 'error',
        mappedEntity: null,
        mapping: null,
        validation: { isValid: false, issues: [`Mapping error: ${error.message}`] },
        status: 'error'
      };
    }
  }

  async mapViaNHIAMapping(service, nhiaMapping) {
    let entity;
    let entityType;
    
    switch (nhiaMapping.entityType) {
      case 'medicine':
        entity = nhiaMapping.medicine;
        entityType = 'medicine';
        break;
      case 'procedure':
        entity = nhiaMapping.procedure;
        entityType = 'procedure';
        break;
      case 'lab_test':
        entity = nhiaMapping.labTest;
        entityType = 'lab_test';
        break;
      case 'diagnosis':
        entity = nhiaMapping.diagnosis;
        entityType = 'diagnosis';
        break;
      default:
        entity = null;
    }
    
    if (!entity) {
      return {
        ...service,
        type: nhiaMapping.entityType,
        mappedEntity: null,
        mapping: nhiaMapping,
        validation: { isValid: false, issues: ['Mapped entity not found'] },
        status: 'mapping_invalid'
      };
    }
    
    return {
      ...service,
      type: nhiaMapping.entityType,
      mappedEntity: entity,
      mapping: nhiaMapping,
      validation: this.validateService(service, entity, nhiaMapping),
      status: 'mapped_via_nhia'
    };
  }

  async mapViaDirectLookup(service, serviceCode) {
    console.log(`🔍 Looking up service code: "${serviceCode}"`);
    
    // Check if this is a diagnosis item based on ItemType
    const isDiagnosisItem = (service.itemType === 'Diagnosis' || service.type === 'Diagnosis');
    
    // If it's a diagnosis item, first try to find in system_diagnosis table
    if (isDiagnosisItem) {
      let diagnosis = await systemDiagnosis.findOne({ 
        where: { icd_10_code: { [Op.iLike]: serviceCode } } 
      });
      
      if (diagnosis) {
        console.log(`✅ Found diagnosis: ${diagnosis.diagnosis_name}`);
        return {
          ...service,
          type: 'diagnosis',
          mappedEntity: diagnosis,
          mapping: null,
          validation: this.validateService(service, diagnosis),
          status: 'mapped_direct'
        };
      }
    }
    
    // Try Medicine - Case insensitive search
    console.log(`🔍 Searching Medicine table for code: "${serviceCode}"`);
    let medicine = await Medicine.findOne({ 
      where: { code: { [Op.iLike]: serviceCode } }
    });
    
    if (medicine) {
      console.log(`✅ Found medicine: ${medicine.generic_name} (code: ${medicine.code})`);
      
      // Calculate prices from database if XML has 0
      const dbPrice = medicine.nhia_price || medicine.tariff_ghc || 0;
      const calculatedUnitPrice = service.unitPrice === 0 ? dbPrice : service.unitPrice;
      const calculatedTotal = calculatedUnitPrice * service.quantity;
      const calculatedNHIA = service.nhiaAmount === 0 ? calculatedTotal : service.nhiaAmount;
      
      return {
        ...service,
        type: 'medicine',
        mappedEntity: medicine,
        mapping: null,
        // Use calculated prices from database
        unitPrice: calculatedUnitPrice,
        totalAmount: calculatedTotal,
        nhiaAmount: calculatedNHIA,
        patientAmount: 0, // NHIS covers full amount
        validation: this.validateService(service, medicine),
        status: 'mapped_direct'
      };
    } else {
      console.log(`❌ Medicine not found for code: "${serviceCode}"`);
    }
    
    // Try Procedure (GDRGCode) - Case insensitive search
    let procedure = await GDRGCode.findOne({ 
      where: { code: { [Op.iLike]: serviceCode } }
    });
    
    if (procedure) {
      console.log(`✅ Found procedure: ${procedure.description}`);
      
      // Calculate prices from database if XML has 0
      const dbPrice = procedure.nhia_price || procedure.tariff_ghc || 0;
      const calculatedUnitPrice = service.unitPrice === 0 ? dbPrice : service.unitPrice;
      const calculatedTotal = calculatedUnitPrice * service.quantity;
      const calculatedNHIA = service.nhiaAmount === 0 ? calculatedTotal : service.nhiaAmount;
      
      return {
        ...service,
        type: 'procedure',
        mappedEntity: procedure,
        mapping: null,
        // Use calculated prices from database
        unitPrice: calculatedUnitPrice,
        totalAmount: calculatedTotal,
        nhiaAmount: calculatedNHIA,
        patientAmount: 0,
        validation: this.validateService(service, procedure),
        status: 'mapped_direct'
      };
    }
    
    // Try Lab Test - Case insensitive search
    let labTest = await LabInvestigation.findOne({ 
      where: { g_drg_code: { [Op.iLike]: serviceCode } }
    });
    
    if (labTest) {
      console.log(`✅ Found lab test: ${labTest.test_description}`);
      
      // Calculate prices from database if XML has 0
      const dbPrice = labTest.nhia_price || labTest.tariff_ghc || 0;
      const calculatedUnitPrice = service.unitPrice === 0 ? dbPrice : service.unitPrice;
      const calculatedTotal = calculatedUnitPrice * service.quantity;
      const calculatedNHIA = service.nhiaAmount === 0 ? calculatedTotal : service.nhiaAmount;
      
      return {
        ...service,
        type: 'lab_test',
        mappedEntity: labTest,
        mapping: null,
        // Use calculated prices from database
        unitPrice: calculatedUnitPrice,
        totalAmount: calculatedTotal,
        nhiaAmount: calculatedNHIA,
        patientAmount: 0,
        validation: this.validateService(service, labTest),
        status: 'mapped_direct'
      };
    }
    
    // Not found in any module
    console.log(`❌ Service code "${serviceCode}" not found in any database table`);
    return {
      ...service,
      type: 'unknown',
      mappedEntity: null,
      mapping: null,
      validation: { isValid: false, issues: ['Service code not found in database'] },
      status: 'not_found'
    };
  }

  validateService(service, entity, mapping = null) {
    const issues = [];
    
    // Use NHIA mapping prices if available, otherwise use entity prices
    const expectedPrice = mapping ? mapping.nhiaPrice : 
                         entity.nhia_price || entity.tariff_ghc || entity.market_price;
    
    const expectedNHIAAmount = mapping ? mapping.nhiaCoverage : 
                              (entity.nhia_price || entity.tariff_ghc) * service.quantity;
    
    // Price validation - skip if XML price is 0 (normal for NHIA claims)
    if (service.unitPrice !== 0 && expectedPrice && service.unitPrice !== expectedPrice) {
      const priceDifference = Math.abs(service.unitPrice - expectedPrice);
      const allowedDifference = expectedPrice * 0.10; // 10% tolerance
      
      if (priceDifference > allowedDifference) {
        issues.push(`Price deviation too high: Expected ₵${expectedPrice}, Got ₵${service.unitPrice}`);
      }
    }
    
    // NHIA amount validation - skip if XML amount is 0
    if (service.nhiaAmount !== 0 && expectedNHIAAmount && service.nhiaAmount !== expectedNHIAAmount) {
      issues.push(`NHIA amount mismatch: Expected ₵${expectedNHIAAmount}, Got ₵${service.nhiaAmount}`);
    }
    
    // Quantity validation (use mapping rules if available)
    const maxQty = mapping ? mapping.maxQuantity : 
                  (entity.maxQuantity || (entity.type === 'medicine' ? 10 : 1));
    
    if (service.quantity > maxQty) {
      issues.push(`Quantity exceeds maximum allowed (${maxQty})`);
    }
    
    // Pre-authorization check
    if (mapping && mapping.requiresPreAuth && !service.preAuthNumber) {
      issues.push('Pre-authorization required but not provided');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      expectedPrice: expectedPrice,
      expectedNHIAAmount: expectedNHIAAmount
    };
  }
}

module.exports = new DatabaseMapperService();
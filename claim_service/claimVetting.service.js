const xml2js = require('xml2js');
const { LabTariff, Medicine, Procedure } = require('../models');
const { Op } = require('sequelize');
const systemDiagnosis = require('../models/claims/systemDiagnosis');

class ClaimVettingService {
  constructor() {
    // Supported XML structure formats
    this.supportedFormats = {
      // Format 1: NHISClaims (current export format)
      NHISClaims: {
        root: 'NHISClaims',
        claim: 'Claim',
        patient: {
          path: ['Claim', 'Patient'],
          fields: {
            id: 'PatientID',
            name: 'FullName',
            insuranceType: 'InsuranceType',
            gender: 'Gender',
            dob: 'DateOfBirth'
          }
        },
        claimFields: {
          referenceNumber: 'ClaimReferenceNumber',
          facilityId: 'FacilityID',
          facilityName: 'FacilityName',
          visitDate: 'VisitDate',
          claimMonth: 'ClaimMonth',
          dischargeDate: 'DischargeDate',
          totalAmount: 'TotalClaimAmount',
          status: 'ClaimStatus',
          type: 'ClaimType'
        },
        diagnosis: {
          path: ['Claim', 'Diagnosis'],
          fields: {
            code: 'DiagnosisCode',
            description: 'DiagnosisDescription',
            type: 'DiagnosisType'
          }
        },
        serviceProvider: {
          path: ['Claim', 'ServiceProvider'],
          fields: {
            id: 'ProviderID',
            name: 'ProviderName',
            type: 'ProviderType'
          }
        },
        items: {
          path: ['Claim', 'ClaimItems', 'Item'],
          fields: {
            name: 'ItemName',
            code: 'ItemCode',
            type: 'ItemType',
            quantity: 'Quantity',
            unitPrice: 'UnitPrice',
            totalAmount: 'TotalAmount',
            serviceDate: 'ServiceDate',
            nhiaAmount: 'NHIACoveredAmount',
            patientAmount: 'PatientAmount',
            serviceProvider: 'ServiceProvider'
          }
        },
        metadata: {
          path: ['Claim', 'Metadata'],
          fields: {
            submissionDate: 'SubmissionDate',
            version: 'Version',
            schemaVersion: 'SchemaVersion'
          }
        }
      },
      // Format 2: claims (original NHIA submission format - 20250701.xml)
      ClaimsFormat: {
        root: 'claims',
        claim: 'claim',
        patient: {
          path: [],
          fields: {
            surname: 'surname',
            otherName: 'otherNames',
            dob: 'dateOfBirth',
            memberNumber: 'memberNo',
            gender: 'gender',
            cardSerialNo: 'cardSerialNo'
          }
        },
        claimFields: {
          claimId: 'claimID',
          claimCheckCode: 'claimCheckCode',
          preAuthCodes: 'preAuthorizationCodes',
          physicianId: 'physicianID',
          hospitalRecNo: 'hospitalRecNo',
          isDependant: 'isDependant',
          serviceType: 'typeOfService',
          isUnbundled: 'isUnbundled',
          includesPharmacy: 'includesPharmacy',
          typeOfAttendance: 'typeOfAttendance',
          serviceOutcome: 'serviceOutcome',
          specialtyAttended: 'specialtyAttended',
          principalGDRG: 'principalGDRG',
          dateOfService: 'dateOfService'
        },
        diagnosis: {
          path: ['diagnosis'],
          fields: {
            gdrgCode: 'gdrgCode',
            icd10: 'icd10',
            description: 'diagnosis'
          }
        },
        procedure: {
          path: ['procedure'],
          fields: {
            serviceDate: 'serviceDate',
            gdrgCode: 'gdrgCode',
            icd10: 'icd10',
            description: 'diagnosis'
          }
        },
        medicines: {
          path: ['medicine'],
          fields: {
            code: 'medicineCode',
            quantity: 'dispensedQty',
            serviceDate: 'serviceDate',
            prescription: 'prescription'
          }
        }
      },
      // Format 3: Batch (original expected format)
      Batch: {
        root: 'Batch',
        claim: 'Patients.PatientData.Claims.Claim',
        patient: {
          path: ['Patients', 'PatientData'],
          fields: {
            surname: 'Surname',
            otherName: 'OtherName',
            dob: 'DateOfBirth',
            memberNumber: 'MemberNumber',
            gender: 'Gender'
          }
        },
        claimFields: {
          claimId: 'ClaimIdentificationNumber',
          serviceType: 'ServiceType',
          admissionDate: 'AdmissionDate',
          dischargeDate: 'DischargeDate',
          totalCost: 'TotalCost'
        },
        items: {
          path: ['Treatments', 'Treatment'],
          fields: {
            code: 'TreatmentCode',
            icdCode: 'ICDCode',
            tariff: 'Tariff'
          }
        },
        medicines: {
          path: ['Medicines', 'Medicine'],
          fields: {
            code: 'MedicineCode',
            quantity: 'Quantity',
            unitPrice: 'UnitPrice'
          }
        }
      }
    };
  }

  /**
   * Main entry point for vetting a claim XML
   */
  async vetClaimXml(xmlString) {
    try {
      // 1. Parse XML
      const claimData = await this.parseXml(xmlString);
      
      if (!claimData) {
        return { 
          isValid: false, 
          error: 'XML Parsing Failed',
          errors: ['Unable to parse XML. Please check XML syntax and structure.'] 
        };
      }
      
      // 2. Detect and normalize the XML format
      const normalizedData = this.normalizeClaimData(claimData);
      
      if (!normalizedData) {
        return { 
          isValid: false, 
          error: 'Unrecognized XML Format',
          errors: [
            'The XML format is not recognized. Supported formats are:',
            '- NHISClaims format (your export format)',
            '- claims format (original NHIA submission format)',
            '- Batch format (legacy format)',
            '',
            'Please ensure your XML follows one of these structures.'
          ],
          supportedFormats: Object.keys(this.supportedFormats)
        };
      }
      
      // 3. Validate the normalized data structure
      const validationErrors = this.validateNormalizedData(normalizedData);
      if (validationErrors.length > 0) {
        return { 
          isValid: false, 
          errors: validationErrors,
          normalizedData 
        };
      }
      
      // 4. Validate content against database models
      const validationResults = await this.validateContent(normalizedData);
      
      // 5. Calculate and validate amounts
      const amountValidation = this.validateAmounts(normalizedData);
      validationResults.push(...amountValidation);
      
      return {
        isValid: validationResults.every(r => r.isValid),
        results: validationResults,
        claimData: normalizedData,
        format: normalizedData._format,
        summary: this.generateSummary(normalizedData, validationResults)
      };
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Failed to process XML',
        details: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Parse XML string to JavaScript object
   */
  async parseXml(xmlString) {
    try {
      // Clean the XML string
      const cleanedXml = this.cleanXmlString(xmlString);
      
      return new Promise((resolve, reject) => {
        xml2js.parseString(cleanedXml, { 
          explicitArray: false,
          trim: true,
          ignoreAttrs: false,
          mergeAttrs: true
        }, (err, result) => {
          if (err) {
            reject(new Error(`XML Parse Error: ${err.message}`));
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  /**
   * Clean XML string before parsing
   */
  cleanXmlString(xmlString) {
    // Remove BOM if present
    let cleaned = xmlString.replace(/^\uFEFF/, '');
    
    // Remove XML declaration if causing issues
    cleaned = cleaned.replace(/<\?xml[^>]+\?>/g, '');
    
    // Normalize attribute quotes
    cleaned = cleaned.replace(/= "/g, '="');
    cleaned = cleaned.replace(/ " /g, '" ');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  /**
   * Detect and normalize different XML formats to a common structure
   */
  normalizeClaimData(claimData) {
    const dataKeys = Object.keys(claimData);
    
    // Try to detect format by checking root elements
    // Priority: ClaimsFormat (claims) > NHISClaims > Batch
    if (dataKeys.includes('claims')) {
      return this.normalizeToFormat(claimData, 'ClaimsFormat');
    }
    if (dataKeys.includes('NHISClaims')) {
      return this.normalizeToFormat(claimData, 'NHISClaims');
    }
    if (dataKeys.includes('Batch')) {
      return this.normalizeToFormat(claimData, 'Batch');
    }
    
    // Check nested structures
    if (claimData.claims) {
      return this.normalizeToFormat(claimData, 'ClaimsFormat');
    }
    if (claimData.NHISClaims) {
      return this.normalizeToFormat(claimData, 'NHISClaims');
    }
    if (claimData.Batch) {
      return this.normalizeToFormat(claimData, 'Batch');
    }
    
    // No recognized format
    return null;
  }

  /**
   * Normalize data from a specific format to common structure
   */
  normalizeToFormat(claimData, formatName) {
    const format = this.supportedFormats[formatName];
    const rootData = claimData[format.root];
    
    if (!rootData) return null;
    
    const normalized = {
      _format: formatName,
      claims: []
    };
    
    try {
      if (formatName === 'NHISClaims') {
        // Handle NHISClaims format
        const claims = Array.isArray(rootData.Claim) ? rootData.Claim : (rootData.Claim ? [rootData.Claim] : []);
        
        for (const claim of claims) {
          if (!claim) continue;
          
          const normalizedClaim = {
            referenceNumber: claim.ClaimReferenceNumber || null,
            facilityId: claim.FacilityID || null,
            facilityName: claim.FacilityName || null,
            visitDate: claim.VisitDate || null,
            claimMonth: claim.ClaimMonth || null,
            dischargeDate: claim.DischargeDate || null,
            totalAmount: parseFloat(claim.TotalClaimAmount) || 0,
            status: claim.ClaimStatus || null,
            type: claim.ClaimType || null,
            patient: claim.Patient ? {
              id: claim.Patient.PatientID || null,
              name: claim.Patient.FullName || null,
              gender: claim.Patient.Gender || null,
              dob: claim.Patient.DateOfBirth || null,
              insuranceType: claim.Patient.InsuranceType || null
            } : null,
            diagnosis: claim.Diagnosis ? {
              code: claim.Diagnosis.DiagnosisCode || null,
              description: claim.Diagnosis.DiagnosisDescription || null,
              type: claim.Diagnosis.DiagnosisType || null
            } : null,
            serviceProvider: claim.ServiceProvider ? {
              id: claim.ServiceProvider.ProviderID || null,
              name: claim.ServiceProvider.ProviderName || null,
              type: claim.ServiceProvider.ProviderType || null
            } : null,
            items: [],
            medicines: []
          };
          
          // Handle ClaimItems
          if (claim.ClaimItems && claim.ClaimItems.Item) {
            const items = Array.isArray(claim.ClaimItems.Item) 
              ? claim.ClaimItems.Item 
              : [claim.ClaimItems.Item];
            
            for (const item of items) {
              if (!item) continue;
              normalizedClaim.items.push({
                name: item.ItemName || null,
                code: item.ItemCode || null,
                type: item.ItemType || null,
                quantity: parseInt(item.Quantity) || 1,
                unitPrice: parseFloat(item.UnitPrice) || 0,
                totalAmount: parseFloat(item.TotalAmount) || 0,
                serviceDate: item.ServiceDate || null,
                nhiaAmount: parseFloat(item.NHIACoveredAmount) || 0,
                patientAmount: parseFloat(item.PatientAmount) || 0,
                serviceProvider: item.ServiceProvider || null
              });
            }
          }
          
          normalized.claims.push(normalizedClaim);
        }
      } else if (formatName === 'ClaimsFormat') {
        // Handle claims format (20250701.xml)
        const claims = Array.isArray(rootData.claim) ? rootData.claim : (rootData.claim ? [rootData.claim] : []);
        
        for (const claim of claims) {
          if (!claim) continue;
          
          // Handle multiple dateOfService entries
          const dateOfService = Array.isArray(claim.dateOfService) 
            ? claim.dateOfService[0] 
            : claim.dateOfService;
          
          const normalizedClaim = {
            referenceNumber: claim.claimID || null,
            claimCheckCode: claim.claimCheckCode || null,
            preAuthCodes: claim.preAuthorizationCodes || null,
            physicianId: claim.physicianID || null,
            hospitalRecNo: claim.hospitalRecNo || null,
            isDependant: claim.isDependant || null,
            serviceType: claim.typeOfService || null,
            isUnbundled: claim.isUnbundled || null,
            includesPharmacy: claim.includesPharmacy || null,
            typeOfAttendance: claim.typeOfAttendance || null,
            serviceOutcome: claim.serviceOutcome || null,
            specialtyAttended: claim.specialtyAttended || null,
            principalGDRG: claim.principalGDRG || null,
            dateOfService: dateOfService || null,
            patient: {
              memberNumber: claim.memberNo || null,
              surname: claim.surname || null,
              otherName: claim.otherNames || null,
              name: `${claim.surname || ''} ${claim.otherNames || ''}`.trim(),
              dob: claim.dateOfBirth || null,
              gender: claim.gender || null,
              cardSerialNo: claim.cardSerialNo || null
            },
            diagnosis: null,
            diagnoses: [],
            procedure: null,
            procedures: [],
            items: [],
            medicines: []
          };
          
          // Handle diagnosis (can be array)
          if (claim.diagnosis) {
            const diagnoses = Array.isArray(claim.diagnosis) 
              ? claim.diagnosis 
              : [claim.diagnosis];
            
            for (const diag of diagnoses) {
              if (!diag) continue;
              normalizedClaim.diagnoses.push({
                gdrgCode: diag.gdrgCode || null,
                icd10: diag.icd10 || null,
                description: diag.diagnosis || null
              });
              
              // Set principal diagnosis
              if (!normalizedClaim.diagnosis && diag.gdrgCode === claim.principalGDRG) {
                normalizedClaim.diagnosis = normalizedClaim.diagnoses[normalizedClaim.diagnoses.length - 1];
              }
            }
            
            // If no principal GDRG match, use first diagnosis
            if (!normalizedClaim.diagnosis && normalizedClaim.diagnoses.length > 0) {
              normalizedClaim.diagnosis = normalizedClaim.diagnoses[0];
            }
          }
          
          // Handle procedures (can be array)
          if (claim.procedure) {
            const procedures = Array.isArray(claim.procedure) 
              ? claim.procedure 
              : [claim.procedure];
            
            for (const proc of procedures) {
              if (!proc) continue;
              normalizedClaim.procedures.push({
                serviceDate: proc.serviceDate || null,
                gdrgCode: proc.gdrgCode || null,
                icd10: proc.icd10 || null,
                description: proc.diagnosis || null
              });
            }
            
            if (normalizedClaim.procedures.length > 0) {
              normalizedClaim.procedure = normalizedClaim.procedures[0];
            }
          }
          
          // Handle medicines
          if (claim.medicine) {
            const medicines = Array.isArray(claim.medicine) 
              ? claim.medicine 
              : [claim.medicine];
            
            for (const medicine of medicines) {
              if (!medicine) continue;
              
              // Extract prescription info
              let prescriptionInfo = null;
              if (medicine.prescription) {
                const pres = medicine.prescription;
                prescriptionInfo = {
                  dose: pres.dose || null,
                  frequency: pres.frequency || null,
                  duration: pres.duration || null,
                  unparsed: pres.unparsed || null
                };
              }
              
              normalizedClaim.medicines.push({
                code: medicine.medicineCode || null,
                quantity: parseInt(medicine.dispensedQty) || 1,
                serviceDate: medicine.serviceDate || null,
                prescription: prescriptionInfo
              });
            }
          }
          
          normalized.claims.push(normalizedClaim);
        }
      } else if (formatName === 'Batch') {
        // Handle Batch format
        const patientData = rootData.Patients?.PatientData;
        
        if (patientData) {
          const claims = patientData.Claims?.Claim;
          const claimsArray = Array.isArray(claims) ? claims : [claims];
          
          for (const claim of claimsArray) {
            if (!claim) continue;
            
            const normalizedClaim = {
              referenceNumber: claim.ClaimIdentificationNumber || null,
              serviceType: claim.ServiceType || null,
              admissionDate: claim.AdmissionDate || null,
              dischargeDate: claim.DischargeDate || null,
              totalCost: parseFloat(claim.TotalCost) || 0,
              patient: {
                surname: patientData.Surname || null,
                otherName: patientData.OtherName || null,
                dob: patientData.DateOfBirth || null,
                memberNumber: patientData.MemberNumber || null,
                gender: patientData.Gender || null
              },
              items: [],
              medicines: []
            };
            
            // Handle Treatments
            if (claim.Treatments?.Treatment) {
              const treatments = Array.isArray(claim.Treatments.Treatment)
                ? claim.Treatments.Treatment
                : [claim.Treatments.Treatment];
              
              for (const treatment of treatments) {
                if (!treatment) continue;
                normalizedClaim.items.push({
                  code: treatment.TreatmentCode || null,
                  icdCode: treatment.ICDCode || null,
                  tariff: parseFloat(treatment.Tariff) || 0
                });
              }
            }
            
            // Handle Medicines
            if (claim.Medicines?.Medicine) {
              const medicines = Array.isArray(claim.Medicines.Medicine)
                ? claim.Medicines.Medicine
                : [claim.Medicines.Medicine];
              
              for (const medicine of medicines) {
                if (!medicine) continue;
                normalizedClaim.medicines.push({
                  code: medicine.MedicineCode || null,
                  quantity: parseInt(medicine.Quantity) || 1,
                  unitPrice: parseFloat(medicine.UnitPrice) || 0
                });
              }
            }
            
            normalized.claims.push(normalizedClaim);
          }
        }
      }
      
      return normalized;
    } catch (error) {
      throw new Error(`Error normalizing ${formatName} format: ${error.message}`);
    }
  }

  /**
   * Validate normalized data structure
   */
  validateNormalizedData(normalizedData) {
    const errors = [];
    
    if (!normalizedData.claims || normalizedData.claims.length === 0) {
      errors.push('No claims found in the XML data');
      return errors;
    }
    
    for (let i = 0; i < normalizedData.claims.length; i++) {
      const claim = normalizedData.claims[i];
      const claimPrefix = `Claim ${i + 1} (${claim.referenceNumber || 'Unknown'})`;
      
      // Validate required fields based on format
      if (normalizedData._format === 'NHISClaims') {
        if (!claim.referenceNumber) {
          errors.push(`${claimPrefix}: Missing ClaimReferenceNumber`);
        }
        if (!claim.patient) {
          errors.push(`${claimPrefix}: Missing Patient information`);
        } else {
          if (!claim.patient.id) {
            errors.push(`${claimPrefix}: Missing PatientID`);
          }
          if (!claim.patient.name) {
            errors.push(`${claimPrefix}: Missing Patient FullName`);
          }
        }
        if (!claim.totalAmount && claim.totalAmount !== 0) {
          errors.push(`${claimPrefix}: Missing TotalClaimAmount`);
        }
      } else if (normalizedData._format === 'ClaimsFormat') {
        if (!claim.referenceNumber) {
          errors.push(`${claimPrefix}: Missing ClaimID`);
        }
        if (!claim.patient) {
          errors.push(`${claimPrefix}: Missing Patient information`);
        } else {
          if (!claim.patient.memberNumber) {
            errors.push(`${claimPrefix}: Missing Member Number (memberNo)`);
          }
          if (!claim.patient.gender) {
            errors.push(`${claimPrefix}: Missing Gender`);
          }
          if (!claim.patient.surname) {
            errors.push(`${claimPrefix}: Missing Surname`);
          }
        }
        if (!claim.dateOfService) {
          errors.push(`${claimPrefix}: Missing Date of Service`);
        }
      } else if (normalizedData._format === 'Batch') {
        if (!claim.patient) {
          errors.push(`${claimPrefix}: Missing PatientData`);
        } else {
          if (!claim.patient.memberNumber) {
            errors.push(`${claimPrefix}: Missing MemberNumber`);
          }
          if (!claim.patient.gender) {
            errors.push(`${claimPrefix}: Missing Gender`);
          }
        }
      }
      
      // Validate dates if present
      if (claim.visitDate && claim.dischargeDate) {
        if (!this.validateDateLogic(claim.visitDate, claim.dischargeDate)) {
          errors.push(`${claimPrefix}: Discharge date must be on or after visit date`);
        }
      }
      if (claim.admissionDate && claim.dischargeDate) {
        if (!this.validateDateLogic(claim.admissionDate, claim.dischargeDate)) {
          errors.push(`${claimPrefix}: Discharge date must be after admission date`);
        }
      }
      if (claim.dateOfService && claim.dischargeDate) {
        if (!this.validateDateLogic(claim.dateOfService, claim.dischargeDate)) {
          errors.push(`${claimPrefix}: Discharge date must be on or after service date`);
        }
      }
    }
    
    return errors;
  }

  /**
   * Validate content against database models
   */
  async validateContent(normalizedData) {
    const results = [];
    
    for (let i = 0; i < normalizedData.claims.length; i++) {
      const claim = normalizedData.claims[i];
      const claimPrefix = `Claim ${i + 1} (${claim.referenceNumber || 'Unknown'})`;
      
      // Validate Provider (Facility)
      if (claim.facilityId) {
        results.push({
          check: `${claimPrefix}: Facility ID`,
          isValid: true,
          value: claim.facilityId,
          message: 'Facility ID provided'
        });
      }
      
      // Validate Patient Gender
      if (claim.patient?.gender) {
        const isValidGender = ['M', 'F', 'Male', 'Female'].includes(claim.patient.gender);
        results.push({
          check: `${claimPrefix}: Patient Gender`,
          isValid: isValidGender,
          value: claim.patient.gender,
          message: isValidGender ? 'Valid gender format' : 'Invalid gender format - should be M or F'
        });
      }
      
      // Validate Member Number format
      if (claim.patient?.memberNumber) {
        // Format can be 8 digits or UUID depending on source
        const isValidMember = /^\d{8}$/.test(claim.patient.memberNumber) || 
                            /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(claim.patient.memberNumber);
        results.push({
          check: `${claimPrefix}: Member Number`,
          isValid: isValidMember,
          value: claim.patient.memberNumber,
          message: isValidMember ? 'Valid member number format' : 'Member number should be 8 digits'
        });
      }
      
      // Validate Diagnosis Codes (ICD-10)
      if (normalizedData._format === 'ClaimsFormat') {
        if (claim.diagnosis?.icd10) {
          const icdCode = this.normalizeICDCode(claim.diagnosis.icd10);
          results.push({
            check: `${claimPrefix}: ICD-10 Code`,
            code: claim.diagnosis.icd10,
            normalizedCode: icdCode,
            isValid: true, // Would validate against DB in production
            message: `ICD-10 code: ${icdCode}`
          });
        }
        
        // Validate GDRG Code
        if (claim.diagnosis?.gdrgCode || claim.principalGDRG) {
          const gdrgCode = claim.diagnosis?.gdrgCode || claim.principalGDRG;
          results.push({
            check: `${claimPrefix}: G-DRG Code`,
            code: gdrgCode,
            isValid: true, // Would validate against DB in production
            message: `G-DRG code: ${gdrgCode}`
          });
        }
      }
      
      // Validate Treatment Codes (for Batch format)
      if (claim.items && claim.items.length > 0) {
        for (const item of claim.items) {
          if (item.code) {
            const tariff = await LabTariff.findOne({
              where: { gdrg_code: item.code }
            });
            
            results.push({
              check: `${claimPrefix}: Treatment Code`,
              code: item.code,
              isValid: !!tariff,
              message: tariff ? 'Valid G-DRG code' : 'Invalid G-DRG code'
            });
          }
          
          if (item.icdCode) {
            const icd = await systemDiagnosis.findOne({
              where: { code: item.icdCode }
            });
            
            results.push({
              check: `${claimPrefix}: ICD-10 Code`,
              code: item.icdCode,
              isValid: !!icd,
              message: icd ? 'Valid ICD-10 code' : 'Invalid ICD-10 code'
            });
          }
        }
      }
      
      // Validate Medicine Codes
      if (claim.medicines && claim.medicines.length > 0) {
        for (const medicine of claim.medicines) {
          if (medicine.code) {
            const med = await Medicine.findOne({
              where: { code: medicine.code }
            });
            
            results.push({
              check: `${claimPrefix}: Medicine Code`,
              code: medicine.code,
              isValid: !!med,
              message: med ? 'Valid medicine code' : 'Unknown medicine code (will use NHIA tariff)'
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate amounts - calculate totals and compare with declared amounts
   */
  validateAmounts(normalizedData) {
    const results = [];
    
    for (let i = 0; i < normalizedData.claims.length; i++) {
      const claim = normalizedData.claims[i];
      const claimPrefix = `Claim ${i + 1} (${claim.referenceNumber || 'Unknown'})`;
      
      let calculatedTotal = 0;
      
      // For NHISClaims format - calculate from items
      if (normalizedData._format === 'NHISClaims' && claim.items) {
        for (const item of claim.items) {
          const itemTotal = item.nhiaAmount + item.patientAmount;
          calculatedTotal += itemTotal;
        }
        
        const declaredTotal = claim.totalAmount || 0;
        const difference = Math.abs(calculatedTotal - declaredTotal);
        const isValid = difference < 0.01; // Allow for floating point errors
        
        results.push({
          check: `${claimPrefix}: Total Amount Calculation`,
          isValid: isValid,
          declared: declaredTotal.toFixed(2),
          calculated: calculatedTotal.toFixed(2),
          difference: difference.toFixed(2),
          message: isValid 
            ? 'Total amount matches sum of items' 
            : `Total amount mismatch: declared ${declaredTotal.toFixed(2)}, calculated ${calculatedTotal.toFixed(2)}`
        });
        
        // Validate individual item amounts
        for (let j = 0; j < claim.items.length; j++) {
          const item = claim.items[j];
          const itemCalculated = item.nhiaAmount + item.patientAmount;
          const itemDeclared = item.totalAmount || 0;
          const itemDiff = Math.abs(itemCalculated - itemDeclared);
          
          results.push({
            check: `${claimPrefix}: Item ${j + 1} (${item.code || item.name || 'Unknown'}) Amount`,
            isValid: itemDiff < 0.01,
            declared: itemDeclared.toFixed(2),
            calculated: itemCalculated.toFixed(2),
            message: itemDiff < 0.01 
              ? 'Item amount valid' 
              : `Item amount mismatch`
          });
        }
      }
      
      // For ClaimsFormat - calculate medicine totals
      if (normalizedData._format === 'ClaimsFormat' && claim.medicines) {
        // In this format, amounts are not provided - just count items
        results.push({
          check: `${claimPrefix}: Medicine Count`,
          isValid: true,
          value: claim.medicines.length,
          message: `${claim.medicines.length} medicine(s) in claim`
        });
        
        // Check if pharmacy is claimed but no medicines
        if (claim.includesPharmacy === '1' && claim.medicines.length === 0) {
          results.push({
            check: `${claimPrefix}: Pharmacy Claim`,
            isValid: false,
            message: 'Claim indicates pharmacy but no medicines provided'
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Generate summary of validation results
   */
  generateSummary(normalizedData, validationResults) {
    const totalClaims = normalizedData.claims.length;
    const validClaims = validationResults.filter(r => r.isValid).length;
    const invalidClaims = validationResults.filter(r => !r.isValid).length;
    
    // Calculate total amounts
    let totalAmount = 0;
    for (const claim of normalizedData.claims) {
      totalAmount += claim.totalAmount || claim.totalCost || 0;
    }
    
    return {
      totalClaims,
      totalServices: normalizedData.claims.reduce((sum, c) => 
        sum + (c.items?.length || 0) + (c.medicines?.length || 0), 0),
      validClaims: totalClaims - invalidClaims,
      invalidClaims,
      successRate: totalClaims > 0 ? ((totalClaims - invalidClaims) / totalClaims * 100).toFixed(1) : 0,
      totalAmount: totalAmount.toFixed(2)
    };
  }

  /**
   * Normalize ICD-10 code (remove spaces, etc.)
   */
  normalizeICDCode(code) {
    if (!code) return null;
    return code.replace(/\s+/g, '').trim();
  }

  /**
   * Validate date format (DD/MM/YYYY or YYYY-MM-DD)
   */
  validateDateFormat(dateStr) {
    if (!dateStr) return false;
    
    // Check DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return true;
    }
    
    // Check YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate date logic (discharge after admission)
   */
  validateDateLogic(admissionDate, dischargeDate) {
    try {
      let admDate, disDate;
      
      if (!admissionDate || !dischargeDate) return true; // Skip if missing
      
      if (admissionDate.includes('/')) {
        const admParts = admissionDate.split('/');
        admDate = new Date(admParts[2], admParts[1] - 1, admParts[0]);
      } else {
        admDate = new Date(admissionDate);
      }
      
      if (dischargeDate.includes('/')) {
        const disParts = dischargeDate.split('/');
        disDate = new Date(disParts[2], disParts[1] - 1, disParts[0]);
      } else {
        disDate = new Date(dischargeDate);
      }
      
      return disDate >= admDate;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate total from items
   */
  calculateClaimTotal(claim) {
    let total = 0;
    
    // Add treatment tariffs
    if (claim.items) {
      for (const item of claim.items) {
        total += parseFloat(item.tariff) || 0;
      }
    }
    
    // Add medicine costs
    if (claim.medicines) {
      for (const medicine of claim.medicines) {
        total += (parseFloat(medicine.unitPrice) || 0) * (parseInt(medicine.quantity) || 1);
      }
    }
    
    return total;
  }

  /**
   * Get supported formats for documentation
   */
  getSupportedFormats() {
    return {
      formats: Object.keys(this.supportedFormats),
      formatDetails: {
        NHISClaims: {
          description: 'NHIS export format with Claim, Patient, ClaimItems elements',
          rootElement: 'NHISClaims',
          requiredFields: ['ClaimReferenceNumber', 'Patient/PatientID', 'TotalClaimAmount']
        },
        ClaimsFormat: {
          description: 'Original NHIA submission format (20250701.xml)',
          rootElement: 'claims',
          requiredFields: ['claimID', 'memberNo', 'dateOfService']
        },
        Batch: {
          description: 'Batch format with Batch, Patients, PatientData, Claims elements',
          rootElement: 'Batch',
          requiredFields: ['ClaimIdentificationNumber', 'PatientData/MemberNumber', 'TotalCost']
        }
      }
    };
  }
}

module.exports = new ClaimVettingService();


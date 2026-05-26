class ValidationService {
  async validateNHIAClaims(mappedData) {
    const validationResults = [];
    const businessRules = await this.getDefaultBusinessRules(); // Use default rules
    
    for (const claim of mappedData.claims) {
      const claimValidation = {
        claimId: claim.claimId,
        nhisNumber: claim.nhisNumber,
        diagnosisValidation: this.validateDiagnosis(claim.diagnosis),
        servicesValidation: [],
        overallStatus: 'pass',
        issues: []
      };
      
      // Validate each service
      for (const service of claim.services) {
        const serviceValidation = this.validateService(service, businessRules);
        claimValidation.servicesValidation.push(serviceValidation);
        
        if (!serviceValidation.isValid) {
          claimValidation.overallStatus = 'fail';
          claimValidation.issues.push(...serviceValidation.issues.map(issue => 
            `${service.serviceCode}: ${issue}`
          ));
        }
      }
      
      // Validate claim-level rules
      const claimLevelValidation = this.validateClaimLevel(claim, businessRules);
      if (!claimLevelValidation.isValid) {
        claimValidation.overallStatus = 'fail';
        claimValidation.issues.push(...claimLevelValidation.issues);
      }
      
      validationResults.push(claimValidation);
    }
    
    return validationResults;
  }

  validateDiagnosis(diagnosis) {
    return {
      code: diagnosis.originalCode,
      isValid: diagnosis.isValid,
      issues: diagnosis.isValid ? [] : ['Invalid ICD-10 code'],
      mappedDiagnosis: diagnosis.mappedDiagnosis
    };
  }

  validateService(service, businessRules) {
    const issues = [];
    
    if (service.status === 'not_found') {
      issues.push('Service code not found in system');
    }
    
    if (service.status === 'error') {
      issues.push('Service mapping error');
    }
    
    // Add validation from default business rules
    if (service.mappedEntity) {
      // Check if service requires pre-authorization (default rule)
      if (this.requiresPreAuthorization(service) && !service.preAuthNumber) {
        issues.push('Pre-authorization required but not provided');
      }
      
      // Check quantity limits (default rule)
      const maxQuantity = this.getMaxQuantity(service);
      if (service.quantity > maxQuantity) {
        issues.push(`Quantity exceeds maximum allowed (${maxQuantity})`);
      }
      
      // Check pricing validation (default rule)
      const priceIssues = this.validatePricing(service);
      issues.push(...priceIssues);
    }
    
    return {
      serviceCode: service.serviceCode,
      serviceType: service.type,
      isValid: issues.length === 0,
      issues: issues,
      mappedEntity: service.mappedEntity,
      validation: service.validation
    };
  }

  validateClaimLevel(claim, businessRules) {
    const issues = [];
    
    // Check claim totals match
    const calculatedTotal = claim.services.reduce((sum, service) => sum + service.totalAmount, 0);
    if (calculatedTotal !== claim.totals.TotalAmount) {
      issues.push(`Total amount mismatch: Calculated ₵${calculatedTotal}, Claimed ₵${claim.totals.TotalAmount}`);
    }
    
    // Check NHIS number format
    if (!this.validateNHISNumber(claim.nhisNumber)) {
      issues.push('Invalid NHIS number format');
    }
    
    // Check claim date validity (default rule)
    if (!this.isClaimDateValid(claim)) {
      issues.push('Claim date is invalid or outside allowed period');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  validateNHISNumber(nhisNumber) {
    // Basic NHIS number validation
    const nhisPattern = /^NHIS-\d{10}$/;
    return nhisPattern.test(nhisNumber);
  }

  // DEFAULT BUSINESS RULES (since you don't have BusinessRule model)
  async getDefaultBusinessRules() {
    return {
      // Service-level rules
      maxQuantities: {
        'medicine': 10,
        'procedure': 5,
        'lab_test': 3,
        'default': 1
      },
      requiresPreAuth: [
        'SURGERY', 'MRI', 'CT-SCAN', 'SPECIALIST' // Example codes that need pre-auth
      ],
      priceTolerance: 0.10, // 10% tolerance for price differences
      
      // Claim-level rules
      maxClaimAgeDays: 30, // Claims must be submitted within 30 days
      minClaimAmount: 5, // Minimum claim amount
      maxClaimAmount: 10000 // Maximum claim amount
    };
  }

  // Helper methods for default rules
  requiresPreAuthorization(service) {
    const preAuthServices = ['SURGERY', 'MRI', 'CT-SCAN', 'SPECIALIST'];
    return preAuthServices.some(code => 
      service.serviceCode.includes(code) || 
      (service.mappedEntity && service.mappedEntity.description?.includes(code))
    );
  }

  getMaxQuantity(service) {
    const rules = {
      'medicine': 10,
      'procedure': 5,
      'lab_test': 3,
      'default': 1
    };
    return rules[service.type] || rules.default;
  }

  validatePricing(service) {
    const issues = [];
    const tolerance = 0.10; // 10% tolerance
    
    // Skip validation if XML price is 0 - this is normal for NHIA claims
    // The system should use database prices instead
    if (service.unitPrice === 0) {
      return issues; // No issues - we'll use database prices
    }
    
    if (service.mappedEntity && service.mappedEntity.nhia_price) {
      const expectedPrice = service.mappedEntity.nhia_price;
      const priceDifference = Math.abs(service.unitPrice - expectedPrice);
      const allowedDifference = expectedPrice * tolerance;
      
      if (priceDifference > allowedDifference) {
        issues.push(`Price deviation too high: Expected ₵${expectedPrice}, Got ₵${service.unitPrice}`);
      }
    }
    
    return issues;
  }

  isClaimDateValid(claim) {
    // Check if claim date is within allowed period (e.g., not in future, not too old)
    const claimDate = new Date(claim.dateOfAttendance || claim.submission_date);
    const today = new Date();
    const maxAgeDays = 30;
    
    return claimDate <= today && 
           (today - claimDate) <= (maxAgeDays * 24 * 60 * 60 * 1000);
  }
}

module.exports = new ValidationService();
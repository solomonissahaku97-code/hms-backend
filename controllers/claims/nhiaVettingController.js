const xmlParserService = require('../../service/xmlParserService');
const databaseMapperService = require('../../service/databaseMapperService');
const validationService = require('../../service/validationService');
const { ValidationError, ProcessingError } = require('../../errorHandler/errorHandler');
const NHIAMapping = require('../../models/vetting/NHIAMapping');
const fs = require('fs').promises;


exports.processNHIAXML = async (req, res) => {
    try {
        if (!req.file) {
            throw new ValidationError('No XML file uploaded');
        }

        // Validate file type
        if (!req.file.mimetype.includes('xml') && !req.file.originalname.endsWith('.xml')) {
            throw new ValidationError('Only XML files are allowed');
        }

        // 1. Parse XML file
        const startTime = Date.now();
        console.log('🔄 Starting XML parsing...');
        const xmlData = await xmlParserService.parseXMLFile(req.file);
        console.log(`✅ XML parsed in ${Date.now() - startTime}ms`);

        // 2. Map to database entities
        console.log('🔄 Mapping to database entities...');
        const mappedData = await databaseMapperService.mapToDatabase(xmlData);
        console.log(`✅ Mapped ${mappedData.claims.length} claims`);

        // 3. Validate against business rules (parallel processing for better performance)
        console.log('🔄 Validating claims...');
        const validationResults = await Promise.all(
            mappedData.claims.map((claim, index) => validateClaimAsync(claim, index))
        );
        console.log(`✅ Validated ${validationResults.length} claims in ${Date.now() - startTime}ms`);

        // 4. Calculate summary statistics
        const totalServices = mappedData.claims.reduce((sum, claim) => sum + claim.services.length, 0);
        const passedServices = validationResults.reduce((sum, result) =>
            sum + result.servicesValidation.filter(s => s.isValid).length, 0
        );

        const overallStatus = validationResults.every(result => result.overallStatus === 'pass')
            ? 'pass' : 'fail';

        // 5. Prepare response - don't include full XML content to reduce response size
        const response = {
            success: true,
            data: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                uploadDate: new Date().toISOString(),
                overallStatus: overallStatus,
                validationSummary: {
                    totalClaims: mappedData.claims.length,
                    totalServices: totalServices,
                    passedServices: passedServices,
                    failedServices: totalServices - passedServices,
                    successRate: totalServices > 0 ? Math.round((passedServices / totalServices) * 100) : 0
                },
                claims: mappedData.claims.map((claim, index) => ({
                    claimId: claim.claimId,
                    nhisNumber: claim.nhisNumber,
                    memberName: claim.memberName,
                    diagnosisDescription: claim.diagnosisDescription,
                    validationStatus: validationResults[index].overallStatus,
                    servicesCount: claim.services.length,
                    totalAmount: claim.services.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
                    services: claim.services.map((service, serviceIndex) => ({
                        serviceId: service.serviceId,
                        serviceCode: service.serviceCode,
                        description: service.description,
                        quantity: service.quantity,
                        unitPrice: service.unitPrice,
                        totalAmount: service.totalAmount,
                        nhiaAmount: service.nhiaAmount,
                        patientAmount: service.patientAmount,
                        type: service.type,
                        mappedEntity: service.mappedEntity ? {
                            id: service.mappedEntity.id,
                            code: service.mappedEntity.code || service.mappedEntity.g_drg_code,
                            name: service.mappedEntity.generic_name || service.mappedEntity.description || service.mappedEntity.test_description,
                            nhia_price: service.mappedEntity.nhia_price || service.mappedEntity.tariff_ghc
                        } : null,
                        validation: validationResults[index].servicesValidation[serviceIndex]
                    }))
                })),
                validationDetails: validationResults
            },
            metadata: {
                processingTime: Date.now() - startTime,
                processedAt: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        console.error('NHIA Processing Error:', error);

        if (error instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error during NHIA processing'
        });
    }
};

// Helper function for parallel validation
async function validateClaimAsync(claim, index) {
    const validationService = require('../../service/validationService');
    const businessRules = await validationService.getDefaultBusinessRules();
    
    const claimValidation = {
        claimId: claim.claimId,
        nhisNumber: claim.nhisNumber,
        diagnosisValidation: validationService.validateDiagnosis(claim.diagnosisCode),
        servicesValidation: [],
        overallStatus: 'pass',
        issues: []
    };
    
    // Validate each service
    for (const service of claim.services) {
        const serviceValidation = validationService.validateService(service, businessRules);
        claimValidation.servicesValidation.push(serviceValidation);
        
        if (!serviceValidation.isValid) {
            claimValidation.overallStatus = 'fail';
            claimValidation.issues.push(...serviceValidation.issues.map(issue => 
                `${service.serviceCode}: ${issue}`
            ));
        }
    }
    
    // Validate claim-level rules
    const claimLevelValidation = validationService.validateClaimLevel(claim, businessRules);
    if (!claimLevelValidation.isValid) {
        claimValidation.overallStatus = 'fail';
        claimValidation.issues.push(...claimLevelValidation.issues);
    }
    
    return claimValidation;
}

exports.getValidationRules = async (req, res) => {
    try {
        const rules = await validationService.getValidationRules();
        res.json({
            success: true,
            data: rules,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getNHIAMappings = async (req, res) => {
    try {
        const { page = 1, limit = 50, activeOnly = true } = req.query;
        const offset = (page - 1) * limit;


        const whereClause = activeOnly ? { isActive: true } : {};

        const { count, rows: mappings } = await NHIAMapping.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['nhiaCode', 'ASC']],
            include: [
                { association: 'medicine', attributes: ['id', 'code', 'generic_name'] },
                { association: 'procedure', attributes: ['id', 'code', 'description'] },
                { association: 'labTest', attributes: ['id', 'g_drg_code', 'test_description'] },
                { association: 'diagnosis', attributes: ['id', 'icd_10_code', 'diagnosis_name'] }
            ]
        });

        res.json({
            success: true,
            data: {
                mappings,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.createNHIAMapping = async (req, res) => {
    try {
        // const NHIAMapping = require('../models/NHIAMapping');

        const mappingData = {
            ...req.body,
            createdBy: req.user?.id // Assuming you have user authentication
        };

        const mapping = await NHIAMapping.create(mappingData);

        // Fetch the complete mapping with associations
        const completeMapping = await NHIAMapping.findByPk(mapping.id, {
            include: [
                { association: 'medicine', attributes: ['id', 'code', 'generic_name'] },
                { association: 'procedure', attributes: ['id', 'code', 'description'] },
                { association: 'labTest', attributes: ['id', 'g_drg_code', 'test_description'] },
                { association: 'diagnosis', attributes: ['id', 'icd_10_code', 'diagnosis_name'] }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'NHIA mapping created successfully',
            data: completeMapping
        });

    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                error: 'NHIA code already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
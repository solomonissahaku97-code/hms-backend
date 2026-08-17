const { Sequelize } = require('sequelize');
const InstitutionLabTariff = require('../../models/InstitutionLabTariff');
const InstitutionPharmacyPrice = require('../../models/InstitutionPharmacyPrice');
const InstitutionProcedurePrice = require('../../models/InstitutionProcedurePrice');
const LabInvestigation = require('../../models/claims/LabInvestigations');
const Medicine = require('../../models/claims/medication');
const GDRGCode = require('../../models/claims/GDRGCode');
const Institution = require('../../models/institution');

exports.getInstitutionPricing = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { type = 'lab' } = req.params;

        // Ensure the authenticated user belongs to this institution
        if (!req.user || req.user.institution_id !== institution_id) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only view pricing for your own institution.' });
        }

        let data = [];

        if (type === 'lab') {
            const overrides = await InstitutionLabTariff.findAll({
                where: { institution_id },
                include: [{
                    model: LabInvestigation,
                    as: 'labInvestigation'
                }]
            });

            data = overrides.map(override => ({
                id: override.id,
                source_id: override.lab_investigation_id,
                name: override.labInvestigation?.test_description || 'Unknown',
                code: override.labInvestigation?.g_drg_code || '',
                global_tariff_ghc: override.labInvestigation?.tariff_ghc || 0,
                global_market_price: override.labInvestigation?.market_price || 0,
                custom_tariff_ghc: override.tariff_ghc,
                custom_market_price: override.market_price,
                is_active: override.is_active,
                created_at: override.created_at,
                updated_at: override.updated_at
            }));
        } else if (type === 'pharmacy') {
            const overrides = await InstitutionPharmacyPrice.findAll({
                where: { institution_id },
                include: [{
                    model: Medicine,
                    as: 'medicine'
                }]
            });

            data = overrides.map(override => ({
                id: override.id,
                source_id: override.medicine_id,
                name: override.medicine?.generic_name || 'Unknown',
                code: override.medicine?.code || '',
                global_market_price: override.medicine?.market_price || 0,
                global_nhia_price: override.medicine?.nhia_price || 0,
                custom_market_price: override.market_price,
                custom_nhia_price: override.nhia_price,
                is_active: override.is_active,
                created_at: override.created_at,
                updated_at: override.updated_at
            }));
        } else if (type === 'procedure') {
            const overrides = await InstitutionProcedurePrice.findAll({
                where: { institution_id },
                include: [{
                    model: GDRGCode,
                    as: 'gdrgCode'
                }]
            });

            data = overrides.map(override => ({
                id: override.id,
                source_id: override.gdrg_code_id,
                name: override.gdrgCode?.description || 'Unknown',
                code: override.gdrgCode?.code || '',
                global_market_price: override.gdrgCode?.market_price || 0,
                global_nhia_price: override.gdrgCode?.nhia_price || 0,
                custom_market_price: override.market_price,
                custom_nhia_price: override.nhia_price,
                is_active: override.is_active,
                created_at: override.created_at,
                updated_at: override.updated_at
            }));
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching institution pricing:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch institution pricing', error: error.message });
    }
};

exports.setInstitutionPricing = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { type } = req.params;

        console.log('[PRICING] setInstitutionPricing called', {
          institution_id,
          type,
          source_id: req.body?.source_id,
          prices: req.body?.prices,
          user: req.user?.id,
          user_institution_id: req.user?.institution_id
        });

        if (!req.user || req.user.institution_id !== institution_id) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only set pricing for your own institution.' });
        }

        const { source_id, prices } = req.body;

        if (!['lab', 'pharmacy', 'procedure'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid pricing type. Must be lab, pharmacy, or procedure' });
        }

        let override;
        const commonWhere = { institution_id };

        if (type === 'lab') {
            commonWhere.lab_investigation_id = source_id;
            [override] = await InstitutionLabTariff.findOrCreate({
                where: commonWhere,
                defaults: {
                    institution_id,
                    lab_investigation_id: source_id,
                    tariff_ghc: prices.tariff_ghc,
                    market_price: prices.market_price,
                    is_active: true
                }
            });

            if (override.isNewRecord) {
                console.log('[PRICING] Created lab tariff', {
                  id: override.id,
                  institution_id,
                  lab_investigation_id: source_id,
                  tariff_ghc: prices.tariff_ghc,
                  market_price: prices.market_price,
                  is_active: true
                });
            }

            if (!override.isNewRecord) {
                override.tariff_ghc = prices.tariff_ghc;
                override.market_price = prices.market_price;
                override.is_active = true;
                await override.save();
                console.log('[PRICING] Updated lab tariff', {
                  id: override.id,
                  institution_id,
                  lab_investigation_id: source_id,
                  tariff_ghc: prices.tariff_ghc,
                  market_price: prices.market_price,
                  is_active: true
                });
            }
        } else if (type === 'pharmacy') {
            commonWhere.medicine_id = source_id;
            [override] = await InstitutionPharmacyPrice.findOrCreate({
                where: commonWhere,
                defaults: {
                    institution_id,
                    medicine_id: source_id,
                    market_price: prices.market_price,
                    nhia_price: prices.nhia_price,
                    is_active: true
                }
            });

            if (override.isNewRecord) {
                console.log('[PRICING] Created pharmacy price', {
                  id: override.id,
                  institution_id,
                  medicine_id: source_id,
                  market_price: prices.market_price,
                  nhia_price: prices.nhia_price,
                  is_active: true
                });
            }

            if (!override.isNewRecord) {
                override.market_price = prices.market_price;
                override.nhia_price = prices.nhia_price;
                override.is_active = true;
                await override.save();
                console.log('[PRICING] Updated pharmacy price', {
                  id: override.id,
                  institution_id,
                  medicine_id: source_id,
                  market_price: prices.market_price,
                  nhia_price: prices.nhia_price,
                  is_active: true
                });
            }
        } else if (type === 'procedure') {
            commonWhere.gdrg_code_id = source_id;
            [override] = await InstitutionProcedurePrice.findOrCreate({
                where: commonWhere,
                defaults: {
                    institution_id,
                    gdrg_code_id: source_id,
                    market_price: prices.market_price,
                    nhia_price: prices.nhia_price,
                    is_active: true
                }
            });

            if (override.isNewRecord) {
                console.log('[PRICING] Created procedure price', {
                  id: override.id,
                  institution_id,
                  gdrg_code_id: source_id,
                  market_price: prices.market_price,
                  nhia_price: prices.nhia_price,
                  is_active: true
                });
            }

            if (!override.isNewRecord) {
                override.market_price = prices.market_price;
                override.nhia_price = prices.nhia_price;
                override.is_active = true;
                await override.save();
                console.log('[PRICING] Updated procedure price', {
                  id: override.id,
                  institution_id,
                  gdrg_code_id: source_id,
                  market_price: prices.market_price,
                  nhia_price: prices.nhia_price,
                  is_active: true
                });
            }
        }

        res.json({ success: true, data: override, message: 'Pricing updated successfully' });
    } catch (error) {
        console.error('Error setting institution pricing:', error);
        res.status(500).json({ success: false, message: 'Failed to update institution pricing', error: error.message });
    }
};

exports.clearInstitutionPricing = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { type } = req.params;

        if (!req.user || req.user.institution_id !== institution_id) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only clear pricing for your own institution.' });
        }

        const { source_id } = req.body;

        if (!['lab', 'pharmacy', 'procedure'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid pricing type' });
        }

        if (type === 'lab') {
            await InstitutionLabTariff.destroy({
                where: { institution_id, lab_investigation_id: source_id }
            });
        } else if (type === 'pharmacy') {
            await InstitutionPharmacyPrice.destroy({
                where: { institution_id, medicine_id: source_id }
            });
        } else if (type === 'procedure') {
            await InstitutionProcedurePrice.destroy({
                where: { institution_id, gdrg_code_id: source_id }
            });
        }

        res.json({ success: true, message: 'Pricing override cleared successfully' });
    } catch (error) {
        console.error('Error clearing institution pricing:', error);
        res.status(500).json({ success: false, message: 'Failed to clear institution pricing', error: error.message });
    }
};

exports.getAvailablePricingCatalog = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { type = 'lab' } = req.query;

        if (!req.user || req.user.institution_id !== institution_id) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only view the pricing catalog for your own institution.' });
        }

        let data = [];

        if (type === 'lab') {
            const investigations = await LabInvestigation.findAll({
                include: [{
                    model: InstitutionLabTariff,
                    as: 'institutionLabTariffs',
                    where: { institution_id },
                    required: false
                }]
            });

            data = investigations.map(inv => {
                const override = inv.institutionLabTariffs?.[0];
                return {
                    source_id: inv.id,
                    name: inv.test_description,
                    code: inv.g_drg_code,
                    global_tariff_ghc: inv.tariff_ghc,
                    global_market_price: inv.market_price,
                    custom_tariff_ghc: override?.tariff_ghc,
                    custom_market_price: override?.market_price,
                    has_override: !!override,
                    is_active: override?.is_active ?? true
                };
            });
        } else if (type === 'pharmacy') {
            const medicines = await Medicine.findAll({
                include: [{
                    model: InstitutionPharmacyPrice,
                    as: 'institutionPharmacyPrices',
                    where: { institution_id },
                    required: false
                }]
            });

            data = medicines.map(med => {
                const override = med.institutionPharmacyPrices?.[0];
                return {
                    source_id: med.id,
                    name: med.generic_name,
                    code: med.code,
                    global_market_price: med.market_price,
                    global_nhia_price: med.nhia_price,
                    custom_market_price: override?.market_price,
                    custom_nhia_price: override?.nhia_price,
                    has_override: !!override,
                    is_active: override?.is_active ?? true
                };
            });
        } else if (type === 'procedure') {
            const codes = await GDRGCode.findAll({
                include: [{
                    model: InstitutionProcedurePrice,
                    as: 'institutionProcedurePrices',
                    where: { institution_id },
                    required: false
                }]
            });

            data = codes.map(code => {
                const override = code.institutionProcedurePrices?.[0];
                return {
                    source_id: code.id,
                    name: code.description,
                    code: code.code,
                    global_market_price: code.market_price,
                    global_nhia_price: code.nhia_price,
                    custom_market_price: override?.market_price,
                    custom_nhia_price: override?.nhia_price,
                    has_override: !!override,
                    is_active: override?.is_active ?? true
                };
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching pricing catalog:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricing catalog', error: error.message });
    }
};

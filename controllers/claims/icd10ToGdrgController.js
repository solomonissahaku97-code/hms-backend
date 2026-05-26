const fs = require('fs');
const path = require('path');
const ICD10ToGDRG = require('../../models/claims/ICD10ToGDRG');

// JSON file path to sync manually created mappings
const JSON_PATH = path.join(__dirname, '../assets/grouped_icd10_to_gdrg_mappings.json');

const addManualMapping = async (req, res) => {
    try {
        const {
            gdrg_code,
            gdrg_description,
            condition,
            icd10_codes,
            icd10_diagnoses
        } = req.body;

        // Basic validation
        if (!gdrg_code || !gdrg_description || !Array.isArray(icd10_codes) || !Array.isArray(icd10_diagnoses)) {
            return res.status(400).json({ message: 'Invalid payload.' });
        }

        // Save to database
        const newMapping = await ICD10ToGDRG.create({
            gdrg_code,
            gdrg_description,
            condition: condition || 'None',
            icd10_codes,
            icd10_diagnoses
        });

        // Sync to JSON file
        let mappings = [];
        if (fs.existsSync(JSON_PATH)) {
            const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
            mappings = JSON.parse(rawData);
        }

        mappings.push({
            gdrg_code,
            gdrg_description,
            condition: condition || 'None',
            icd10_codes,
            icd10_diagnoses
        });

        fs.writeFileSync(JSON_PATH, JSON.stringify(mappings, null, 2));

        return res.status(201).json({
            message: 'Mapping added successfully.',
            data: newMapping
        });
    } catch (error) {
        console.error('Error adding manual mapping:', error);
        return res.status(500).json({ message: 'Server error while saving mapping.' });
    }
};

// delete controller
const deleteManualMapping = async (req, res) => {
    try {
        const { gdrg_code } = req.params;

        // Find and delete the mapping from the database
        const deletedMapping = await ICD10ToGDRG.destroy({
            where: { gdrg_code }
        });

        if (!deletedMapping) {
            return res.status(404).json({ message: 'Mapping not found.' });
        }

        // Sync to JSON file
        let mappings = [];
        if (fs.existsSync(JSON_PATH)) {
            const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
            mappings = JSON.parse(rawData);
        }

        mappings = mappings.filter(mapping => mapping.gdrg_code !== gdrg_code);
        fs.writeFileSync(JSON_PATH, JSON.stringify(mappings, null, 2));

        return res.status(200).json({ message: 'Mapping deleted successfully.' });
    } catch (error) {
        console.error('Error deleting manual mapping:', error);
        return res.status(500).json({ message: 'Server error while deleting mapping.' });
    }
};



// fetch all from database
const getAllMappings = async (req, res) => {
    try {
        const mappings = await ICD10ToGDRG.findAll();
        return res.status(200).json(mappings);
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return res.status(500).json({ message: 'Server error while fetching mappings.' });
    }
};

// update controller
const updateManualMapping = async (req, res) => {
    try {
        const { gdrg_code } = req.params;
        const { gdrg_description, condition, icd10_codes, icd10_diagnoses } = req.body;

        // Basic validation
        if (!gdrg_description || !Array.isArray(icd10_codes) || !Array.isArray(icd10_diagnoses)) {
            return res.status(400).json({ message: 'Invalid payload.' });
        }

        // Update in database
        const [updated] = await ICD10ToGDRG.update({
            gdrg_description,
            condition: condition || 'None',
            icd10_codes,
            icd10_diagnoses
        }, {
            where: { gdrg_code }
        });

        if (!updated) {
            return res.status(404).json({ message: 'Mapping not found.' });
        }

        // Sync to JSON file
        let mappings = [];
        if (fs.existsSync(JSON_PATH)) {
            const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
            mappings = JSON.parse(rawData);
        }

        mappings = mappings.map(mapping => {
            if (mapping.gdrg_code === gdrg_code) {
                return {
                    ...mapping,
                    gdrg_description,
                    condition: condition || 'None',
                    icd10_codes,
                    icd10_diagnoses
                };
            }
            return mapping;
        });

        fs.writeFileSync(JSON_PATH, JSON.stringify(mappings, null, 2));

        return res.status(200).json({ message: 'Mapping updated successfully.' });
    } catch (error) {
        console.error('Error updating manual mapping:', error);
        return res.status(500).json({ message: 'Server error while updating mapping.' });
    }
};






module.exports = {
    addManualMapping,
    deleteManualMapping,
    getAllMappings,
    updateManualMapping

};

const SocialDeterminantsOfHealth = require('../../models/SocialDeterminantsOfHealth');
const MedicationAdherence = require('../../models/MedicationAdherence');
const ScreeningReminder = require('../../models/ScreeningReminder');
const WellnessScore = require('../../models/WellnessScore');
const PatientFeedback = require('../../models/PatientFeedback');
const OrganDonor = require('../../models/OrganDonor');
const Patient = require('../../models/patient');

// ==================== SOCIAL DETERMINANTS ====================

exports.createSDOH = async (req, res) => {
    try {
        const sdoh = await SocialDeterminantsOfHealth.create(req.body);
        res.status(201).json({ message: 'SDOH recorded', sdoh });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getPatientSDOH = async (req, res) => {
    try {
        const sdoh = await SocialDeterminantsOfHealth.findAll({
            where: { patient_id: req.params.patient_id, is_active: true },
            order: [['createdAt', 'DESC']]
        });
        res.json({ sdoh });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.updateSDOH = async (req, res) => {
    try {
        const sdoh = await SocialDeterminantsOfHealth.findByPk(req.params.id);
        if (!sdoh) return res.status(404).json({ message: 'Not found' });
        await sdoh.update(req.body);
        res.json({ message: 'Updated', sdoh });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

// ==================== MEDICATION ADHERENCE ====================

exports.createMedicationAdherence = async (req, res) => {
    try {
        const { days_monitored, days_taken_correctly } = req.body;
        const adherence_score = MedicationAdherence.calculateAdherenceScore(days_taken_correctly, days_monitored);
        
        const adherence = await MedicationAdherence.create({
            ...req.body,
            adherence_score
        });
        res.status(201).json({ message: 'Adherence recorded', adherence });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getPatientAdherence = async (req, res) => {
    try {
        const adherence = await MedicationAdherence.findAll({
            where: { patient_id: req.params.patient_id, is_active: true },
            order: [['createdAt', 'DESC']]
        });
        res.json({ adherence });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

// ==================== SCREENING REMINDERS ====================

exports.createScreeningReminder = async (req, res) => {
    try {
        const reminder = await ScreeningReminder.create(req.body);
        res.status(201).json({ message: 'Screening reminder created', reminder });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getPatientScreenings = async (req, res) => {
    try {
        const screenings = await ScreeningReminder.findAll({
            where: { patient_id: req.params.patient_id, is_active: true },
            order: [['recommended_date', 'ASC']]
        });
        res.json({ screenings });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.updateScreeningStatus = async (req, res) => {
    try {
        const screening = await ScreeningReminder.findByPk(req.params.id);
        if (!screening) return res.status(404).json({ message: 'Not found' });
        
        await screening.update(req.body);
        res.json({ message: 'Updated', screening });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getScreeningGuidelines = async (req, res) => {
    res.json({ guidelines: ScreeningReminder.SCREENING_GUIDELINES });
};

// ==================== WELLNESS SCORE ====================

exports.createWellnessScore = async (req, res) => {
    try {
        const { vitals, lifestyle, risk_factors, health_goals } = req.body;
        const scores = WellnessScore.calculateScore(vitals || {}, lifestyle || {}, risk_factors || []);
        
        const wellness = await WellnessScore.create({
            ...req.body,
            ...scores,
            assessment_date: new Date()
        });
        res.status(201).json({ message: 'Wellness score calculated', wellness });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getPatientWellness = async (req, res) => {
    try {
        const wellness = await WellnessScore.findOne({
            where: { patient_id: req.params.patient_id, is_active: true },
            order: [['createdAt', 'DESC']]
        });
        res.json({ wellness });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

// ==================== PATIENT FEEDBACK ====================

exports.createFeedback = async (req, res) => {
    try {
        const feedback = await PatientFeedback.create(req.body);
        res.status(201).json({ message: 'Feedback submitted', feedback });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getPatientFeedback = async (req, res) => {
    try {
        const feedback = await PatientFeedback.findAll({
            where: { patient_id: req.params.patient_id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ feedback });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.respondToFeedback = async (req, res) => {
    try {
        const feedback = await PatientFeedback.findByPk(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Not found' });
        
        await feedback.update({
            response: req.body.response,
            responded_by: req.body.responded_by,
            response_date: new Date(),
            status: 'resolved'
        });
        res.json({ message: 'Response added', feedback });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

// ==================== ORGAN DONOR ====================

exports.createOrganDonor = async (req, res) => {
    try {
        // Check if exists and update or create
        const existing = await OrganDonor.findOne({
            where: { patient_id: req.body.patient_id, is_active: true }
        });
        
        if (existing) {
            await existing.update({ ...req.body, is_active: true });
            return res.json({ message: 'Updated', organDonor: existing });
        }
        
        const organDonor = await OrganDonor.create(req.body);
        res.status(201).json({ message: 'Organ donor status recorded', organDonor });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.getOrganDonor = async (req, res) => {
    try {
        const organDonor = await OrganDonor.findOne({
            where: { patient_id: req.params.patient_id, is_active: true }
        });
        res.json({ organDonor });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};

exports.updateOrganDonor = async (req, res) => {
    try {
        const organDonor = await OrganDonor.findByPk(req.params.id);
        if (!organDonor) return res.status(404).json({ message: 'Not found' });
        
        await organDonor.update(req.body);
        res.json({ message: 'Updated', organDonor });
    } catch (error) {
        res.status(500).json({ message: 'Error', error: error.message });
    }
};


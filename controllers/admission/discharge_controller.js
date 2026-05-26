const Discharge = require("../../models/dishcarge");
const Patient = require("../../models/patient");
const Record = require("../../models/record");
const Staff = require("../../models/staff");
const Visit = require("../../models/Visit");
const { Op, Sequelize } = require("sequelize");
const  sequelize  = require("../../config/database");


const dischargeController = {
  createDischarge: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const {
        patient_id,
        visit_id,
        doctor_id,
        type,
        notes,
        // Routine
        follow_up_date,
        instructions,
        // AMA
        ama_reason,
        risks_acknowledged,
        // Transfer
        facility_name,
        transfer_reason,
        // Expired
        time_of_death,
        cause_of_death,
        death_certificate_number
      } = req.body;

      // Validate required fields
      if (!patient_id || !visit_id || !doctor_id || !type) {
        await t.rollback();
        return res.status(400).json({ error: "patient_id, visit_id, doctor_id and discharge type are required" });
      }

      // Fetch patient + visit
      const patient = await Patient.findByPk(patient_id, { transaction: t });
      const visit = await Visit.findByPk(visit_id, { transaction: t });
      if (!patient || !visit) {
        await t.rollback();
        return res.status(404).json({ error: "Patient or Visit not found" });
      }

      // Type-specific validation
      if (type === "routine" && !follow_up_date) {
        return res.status(400).json({ error: "Follow-up date is required for routine discharge" });
      }
      if (type === "ama" && (!ama_reason || !risks_acknowledged)) {
        return res.status(400).json({ error: "AMA reason and risks acknowledgement are required" });
      }
      if (type === "transfer" && (!facility_name || !transfer_reason)) {
        return res.status(400).json({ error: "Facility name and transfer reason are required" });
      }
      if (type === "expired" && (!time_of_death || !cause_of_death)) {
        return res.status(400).json({ error: "Time of death and cause of death are required" });
      }

      // Build discharge payload
      const dischargeData = {
        patient_id,
        visit_id,
        doctor_id,
        type,
        discharge_date: new Date(),
        notes,
        status: "completed"
      };

      switch (type) {
        case "routine":
          dischargeData.follow_up_date = follow_up_date;
          dischargeData.instructions = instructions;
          break;
        case "ama":
          dischargeData.ama_reason = ama_reason;
          dischargeData.risks_acknowledged = risks_acknowledged;
          break;
        case "transfer":
          dischargeData.facility_name = facility_name;
          dischargeData.transfer_reason = transfer_reason;
          break;
        case "expired":
          dischargeData.time_of_death = time_of_death;
          dischargeData.cause_of_death = cause_of_death;
          dischargeData.death_certificate_number = death_certificate_number;
          break;
      }

      // Create discharge
      const discharge = await Discharge.create(dischargeData, { transaction: t });

      // Update Visit
      await visit.update(
        {
          status: "Completed",
          discharge_date: new Date(),
          discharge_type: type,
          on_admission: false,
          department_id: null,
          bed_number: null,
          admission_status: null
        },
        { transaction: t }
      );

      // Update Patient status
      const newPatientStatus =
        type === "expired" ? "deceased" : type === "transfer" ? "transferred" : "discharged";
      await patient.update({ status: newPatientStatus }, { transaction: t });

      await t.commit();
      return res.status(201).json({
        message: "Discharge record created successfully",
        discharge,
        visit,
        patient
      });
    } catch (error) {
      console.error("Error creating discharge:", error);
      await t.rollback();
      res.status(500).json({ error: "Failed to create discharge record", details: error.message });
    }
  },

  // Get all discharge records with optional filtering
  getAllDischarges: async (req, res) => {
    try {
      const { type, patient_id, doctor_id, start_date, end_date } = req.query;

      const where = {};
      if (type) where.type = type;
      if (patient_id) where.patient_id = patient_id;
      if (doctor_id) where.doctor_id = doctor_id;

      if (start_date || end_date) {
        where.discharge_date = {};
        if (start_date) where.discharge_date[Op.gte] = new Date(start_date);
        if (end_date) where.discharge_date[Op.lte] = new Date(end_date);
      }

      const discharges = await Discharge.findAll({
        where,
        include: [
          { model: Patient, attributes: ['id', 'first_name', 'last_name'] },
          { model: Staff, as: 'Staff', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['discharge_date', 'DESC']]
      });

      res.json(discharges);
    } catch (error) {
      console.error('Error fetching discharges:', error);
      res.status(500).json({ error: 'Failed to fetch discharge records' });
    }
  },

  // Get a single discharge record by ID
  getDischargeById: async (req, res) => {
    try {
      const { id } = req.params;

      const discharge = await Discharge.findByPk(id, {
        include: [
          { model: Patient, attributes: ['id', 'first_name', 'last_name', 'date_of_birth'] },
          { model: Staff, as: 'Doctor', attributes: ['id', 'first_name', 'last_name'] }
        ]
      });

      if (!discharge) {
        return res.status(404).json({ error: 'Discharge record not found' });
      }

      res.json(discharge);
    } catch (error) {
      console.error('Error fetching discharge:', error);
      res.status(500).json({ error: 'Failed to fetch discharge record' });
    }
  },

  // Update a discharge record
  updateDischarge: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Don't allow changing certain fields
      delete updateData.patient_id;
      delete updateData.type;

      const [updated] = await Discharge.update(updateData, {
        where: { id }
      });

      if (!updated) {
        return res.status(404).json({ error: 'Discharge record not found' });
      }

      const updatedDischarge = await Discharge.findByPk(id);
      res.json(updatedDischarge);
    } catch (error) {
      console.error('Error updating discharge:', error);
      res.status(500).json({ error: 'Failed to update discharge record' });
    }
  },

  // Delete a discharge record (soft delete)
  deleteDischarge: async (req, res) => {
    try {
      const { id } = req.params;

      const discharge = await Discharge.findByPk(id);
      if (!discharge) {
        return res.status(404).json({ error: 'Discharge record not found' });
      }

      // Don't allow deletion of expired records
      if (discharge.type === 'expired') {
        return res.status(403).json({ error: 'Cannot delete death records' });
      }

      await Discharge.update(
        { status: 'cancelled' },
        { where: { id } }
      );

      // If it was a routine discharge, revert patient status
      if (discharge.type === 'routine') {
        await Patient.update(
          { status: 'active' },
          { where: { id: discharge.patient_id } }
        );
      }

      res.json({ message: 'Discharge record cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling discharge:', error);
      res.status(500).json({ error: 'Failed to cancel discharge record' });
    }
  },

  // Get discharge statistics
  getDischargeStats: async (req, res) => {
    try {
      const stats = await Discharge.findAll({
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('DATE', sequelize.col('discharge_date')), 'date']
        ],
        group: ['type', sequelize.fn('DATE', sequelize.col('discharge_date'))],
        order: [[sequelize.fn('DATE', sequelize.col('discharge_date'), 'DESC')]]
      });

      res.json(stats);
    } catch (error) {
      console.error('Error fetching discharge stats:', error);
      res.status(500).json({ error: 'Failed to fetch discharge statistics' });
    }
  },

  // Get all deceased patients
  getDeceasedPatients: async (req, res) => {
    try {
      const deceasedPatients = await Record.findAll({
        where: {
          status: 'deceased'
        },
        include: [
          {
            model: Discharge,
            where: { type: 'expired' }, // Only include expired discharge records
            required: true
          },
          {
            model: Patient,
            where: { status: 'deceased' },
            required: true
          }
        ],
        order: [['time_of_death', 'DESC']] // Sort by most recent deaths first
      });

      res.json(deceasedPatients);
    } catch (error) {
      console.error('Error fetching deceased patients:', error);
      res.status(500).json({ error: 'Failed to fetch deceased patients' });
    }
  },
};

module.exports = dischargeController;
const GDRGCode = require('../../models/claims/GDRGCode');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');
const Patient = require('../../models/patient');
const Staff = require('../../models/staff');
const TheatrePatients = require('../../models/theatre/TheatrePatients');
const Visit = require('../../models/Visit');
const VitalSignsRecord = require('../../models/vital_signs_records');

/**
 * @desc Create a new theatre patient booking
 */
exports.createTheatrePatient = async (req, res) => {
  try {
    const {
      visit_id,
      procedure_ids,
      scheduled_date,
      scheduled_time, // Make sure this is included
      surgeon_id,
      anaesthetist_id,
      diagnosis_id,
      notes,
      is_emergency // Make sure this is included
    } = req.body;

    console.log('Request body:', req.body);

    // Validate required fields
    if (!visit_id || !procedure_ids || !diagnosis_id) {
      return res.status(400).json({
        error: 'visit_id, procedure_ids, and diagnosis_id are required.'
      });
    }

    // Validate that procedure_ids is an array
    if (!Array.isArray(procedure_ids)) {
      return res.status(400).json({
        error: 'procedure_ids must be an array.'
      });
    }

    // Validate that diagnosis_id is an array (since you updated the model)
    if (!Array.isArray(diagnosis_id)) {
      return res.status(400).json({
        error: 'diagnosis_id must be an array.'
      });
    }

    // Create theatre booking
    const theatreBooking = await TheatrePatients.create({
      visit_id,
      procedure_ids, // This should now be an array of UUIDs
      scheduled_date: scheduled_date ? new Date(scheduled_date) : null,
      scheduled_time: scheduled_time || null,
      surgeon_id: surgeon_id || null,
      anaesthetist_id: anaesthetist_id || null,
      diagnosis_id,
      notes: notes || null,
      is_emergency: is_emergency || false
    });

    res.status(201).json({
      message: 'Theatre patient booking created successfully.',
      data: theatreBooking,
    });
  } catch (error) {
    console.error('Error creating theatre booking:', error);
    res.status(500).json({
      error: 'Failed to create theatre booking.',
      details: error.message
    });
  }
};

/**
 * @desc Get all theatre patient bookings
 */
exports.getAllTheatrePatients = async (req, res) => {
  try {
    const theatrePatients = await TheatrePatients.findAll({
      include: [
        { 
          model: Visit, 
          as: 'visit',
          include:[
            {
              model:Patient,
              as:'patient'
            },
            {
              model:VitalSignsRecord,
              as:'vitalSignsRecords'
            }
          ]
        },
        { 
          model: Staff, 
          as: 'surgeon' 
        },
        { 
          model: Staff, 
          as: 'anaesthetist' 
        },
      ],
    });

    if (theatrePatients.length === 0) {
      return res.status(200).json({
        message: 'No theatre patient bookings found.',
        data: [],
      });
    }

    // Get all procedure IDs and diagnosis IDs from all patients
    const allProcedureIds = [...new Set(theatrePatients.flatMap(patient => patient.procedure_ids || []))];
    const allDiagnosisIds = [...new Set(theatrePatients.flatMap(patient => patient.diagnosis_id || []))];

    // Fetch all procedures and diagnoses in single queries
    const [allProcedures, allDiagnoses] = await Promise.all([
      allProcedureIds.length > 0 ? GDRGCode.findAll({ 
        where: { id: allProcedureIds },
        // attributes: ['id', 'code', 'description', 'name']
      }) : [],
      allDiagnosisIds.length > 0 ? systemDiagnosis.findAll({
        where: { id: allDiagnosisIds },
        // attributes: ['id', 'name', 'description', 'code']
      }) : []
    ]);

    // Create lookup maps for quick access
    const proceduresMap = allProcedures.reduce((map, procedure) => {
      map[procedure.id] = procedure;
      return map;
    }, {});

    const diagnosesMap = allDiagnoses.reduce((map, diagnosis) => {
      map[diagnosis.id] = diagnosis;
      return map;
    }, {});

    // Map procedures and diagnoses to each patient
    const theatrePatientsWithDetails = theatrePatients.map(patient => {
      const patientData = patient.toJSON();
      
      // Map procedure_ids to actual procedure objects
      patientData.procedures = (patientData.procedure_ids || [])
        .map(id => proceduresMap[id])
        .filter(Boolean); // Remove undefined values
      
      // Map diagnosis_id to actual diagnosis objects
      patientData.diagnoses = (patientData.diagnosis_id || [])
        .map(id => diagnosesMap[id])
        .filter(Boolean); // Remove undefined values
      
      return patientData;
    });

    res.status(200).json({
      message: 'Theatre patient bookings fetched successfully.',
      data: theatrePatientsWithDetails,
    });
  } catch (error) {
    console.error('Error fetching theatre patients:', error);
    res.status(500).json({ 
      error: 'Failed to fetch theatre patients.',
      details: error.message 
    });
  }
};


/**
 * @desc Get a single theatre patient booking by ID
 */
exports.getTheatrePatientById = async (req, res) => {
  try {
    const { id } = req.params;

    // const theatrePatient = await TheatrePatients.findByPk(id, {
    //   include: [
    //     { model: Visit, as: 'visit' },
    //     { model: Staff, as: 'surgeon' },
    //     { model: Staff, as: 'anaesthetist' },
    //     // { model: Procedure, as: 'procedure' },
    //     // { model: Diagnosis, as: 'diagnosis' },
    //   ],
    // });

    // if (!theatrePatient) {
    //   return res.status(404).json({ error: 'Theatre patient booking not found.' });
    // }

    // res.status(200).json(theatrePatient);
  } catch (error) {
    console.error('Error fetching theatre booking:', error);
    res.status(500).json({ error: 'Failed to fetch theatre booking.' });
  }
};

/**
 * @desc Update a theatre patient booking
 */
exports.updateTheatrePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const theatrePatient = await TheatrePatients.findByPk(id);
    if (!theatrePatient) {
      return res.status(404).json({ error: 'Theatre patient booking not found.' });
    }

    await theatrePatient.update(updates);

    res.status(200).json({
      message: 'Theatre patient booking updated successfully.',
      data: theatrePatient,
    });
  } catch (error) {
    console.error('Error updating theatre booking:', error);
    res.status(500).json({ error: 'Failed to update theatre booking.' });
  }
};

/**
 * @desc Delete a theatre patient booking
 */
exports.deleteTheatrePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const theatrePatient = await TheatrePatients.findByPk(id);
    if (!theatrePatient) {
      return res.status(404).json({ error: 'Theatre patient booking not found.' });
    }

    await theatrePatient.destroy();

    res.status(200).json({ message: 'Theatre patient booking deleted successfully.' });
  } catch (error) {
    console.error('Error deleting theatre booking:', error);
    res.status(500).json({ error: 'Failed to delete theatre booking.' });
  }
};

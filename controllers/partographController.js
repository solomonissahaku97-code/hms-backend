const Partograph = require('../models/partograph');
const Patient = require('../models/patient');
const Institution = require('../models/institution');
const https = require('https');

// Controller for Partograph
const partographController = {
  createPartograph: async (req, res) => {
    try {
      const {
        patient_id,
        institution_id,
        cervical_dilation,
        fetal_heart_rate,
        contractions_frequency,
        maternal_pulse,
        maternal_blood_pressure,
        urine_output,
        temperature,
        notes,
        time,
      } = req.body;

      // Validate required fields
      if (!patient_id || !institution_id || !cervical_dilation || !time) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }

      // Check if patient and institution exist (Optional)
      const patient = await Patient.findByPk(patient_id);
      const institution = await Institution.findByPk(institution_id);

      if (!patient || !institution) {
        return res.status(404).json({ message: 'Patient or Institution not found.' });
      }

      // Create Partograph entry
      const partograph = await Partograph.create({
        patient_id,
        institution_id,
        cervical_dilation,
        fetal_heart_rate,
        contractions_frequency,
        maternal_pulse,
        maternal_blood_pressure,
        urine_output,
        temperature,
        notes,
        time
      });

      return res.status(201).json({ message: 'Partograph data submitted successfully.', partograph });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error. Could not submit partograph data.' });
    }
  },

  analyzePartograph: async (req, res) => {
    try {
      const { patient_id } = req.body;
      console.log(req.body);

      // Validate required fields
      if (!patient_id) {
        return res.status(400).json({ message: "Patient ID is required." });
      }

      // Fetch patient details
      const patient = await Patient.findOne({ where: { id: patient_id } });
      if (!patient) {
        return res.status(404).json({ message: "Patient not found." });
      }

      const patientName = `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name} `;

      // Fetch all partograph records for the patient
      const partographRecords = await Partograph.findAll({
        where: { patient_id },
        order: [["time", "ASC"]],
      });

      if (!partographRecords.length) {
        return res
          .status(404)
          .json({ message: "No partograph records found for the patient." });
      }

      // Construct data payload
      const aggregatedData = partographRecords
        .map((record, index) => {
          return `
Record ${index + 1}:
- Time: ${record.time} hrs
- Cervical Dilation: ${record.cervical_dilation} cm
- Fetal Heart Rate: ${record.fetal_heart_rate} bpm
- Contractions Frequency: ${record.contractions_frequency || "N/A"} per 10 minutes
- Maternal Pulse: ${record.maternal_pulse || "N/A"} bpm
- Blood Pressure: ${record.maternal_blood_pressure || "N/A"}
- Urine Output: ${record.urine_output || "N/A"} ml/hr
- Temperature: ${record.temperature || "N/A"} °C
Notes: ${record.notes || "No additional notes"}`;
        })
        .join("\n\n");

      // Gemini AI API request
      const options = {
        method: "POST",
        hostname: "gemini-pro-ai.p.rapidapi.com",
        port: null,
        path: "/",
        headers: {
          "x-rapidapi-key": "440ceec440mshd9aef3849b861f8p11f121jsnb633473d062d", // Replace with your actual key
          "x-rapidapi-host": "gemini-pro-ai.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      };

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze the following Partograph records for ${patientName} and provide insights:
${aggregatedData}

Provide an overall analysis of the progress of labor, trends, and any potential concerns based on the data. Ensure that recommendations have double line breaks for better readability.mention the patient name`,
              },
            ],
          },
        ],
      };

      // Make API request
      const reqAI = https.request(options, (resAI) => {
        const chunks = [];
        resAI.on("data", (chunk) => chunks.push(chunk));
        resAI.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString();
          let analysisResult = JSON.parse(responseBody);

          // Clean up response (remove '**' and ensure new lines in recommendations)
          const cleanedResponse = analysisResult.candidates?.[0]?.content?.parts?.[0]?.text
            .replace(/\*\*/g, "") // Remove bold formatting
            .replace(/Recommendations:/, "\n\nRecommendations:\n");

         

          return res.status(200).json({
            message: "Analysis successful",
            analysis: cleanedResponse,
          });
        });
      });

      reqAI.on("error", (err) => {
        console.error("Error calling Gemini AI:", err);
        return res
          .status(500)
          .json({ message: "Failed to analyze partograph data.", error: err.message });
      });

      reqAI.write(JSON.stringify(payload));
      reqAI.end();
    } catch (error) {
      console.error("Server error:", error);
      return res
        .status(500)
        .json({ message: "Server error during partograph analysis.", error: error.message });
    }
  },


  getAllPartographs: async (req, res) => {
    try {
      const { patient_id, institution_id } = req.query;
      console.log(req.query)

      const patient = await Patient.findOne({ where: { institution_id: institution_id, id: patient_id } })

      if (!patient) return res.status(404).json({ error: 'patient does not exist' })

      const partographs = await Partograph.findAll({
        where: { patient_id: patient_id }
      })

      return res.status(200).json({ partographs });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error. Could not retrieve partograph data.' });
    }
  },

  /**
   * @desc Get single partograph by ID
   * @route GET /api/partographs/:id
   * @access Public or Protected
   */
  getPartographById: async (req, res) => {
    try {
      const { id } = req.params;

      const partograph = await Partograph.findByPk(id, {
        include: [
          { model: Patient, attributes: ['id', 'name'] },
          { model: Institution, attributes: ['id', 'name'] },
        ],
      });

      if (!partograph) {
        return res.status(404).json({ message: 'Partograph not found.' });
      }

      return res.status(200).json({ partograph });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error. Could not retrieve partograph data.' });
    }
  },

  clearPartographs: async (req, res) => {
    try {
      const { patient_id, institution_id } = req.query;

      // Validate required fields
      if (!patient_id || !institution_id) {
        return res.status(400).json({ message: 'Missing required fields: patient_id or institution_id.' });
      }

      // Verify patient and institution exist
      const patient = await Patient.findOne({ where: { id: patient_id, institution_id } });

      if (!patient) {
        return res.status(404).json({ message: 'Patient not found in the specified institution.' });
      }

      // Delete all partographs for the given patient and institution
      const deletedCount = await Partograph.destroy({ where: { patient_id } });

      if (deletedCount === 0) {
        return res.status(404).json({ message: 'No partographs found for the specified patient.' });
      }

      return res.status(200).json({ message: `Successfully deleted ${deletedCount} partograph(s).` });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error. Could not clear partograph data.' });
    }
  },
};

module.exports = partographController;

const ChatAi = require('../models/ChatAi');
const Institution = require('../models/institution');
const PatientNote = require('../models/PatientNote');



/**
 * Fetch all AI responses for a specific patient note
 */
exports.getResponsesByNote = async (req, res) => {
  const { noteId } = req.params;

  try {
    const responses = await ChatAi.findAll({
      where: { patient_note_id: noteId },
      include: [
        { model: PatientNote, as: 'patient_note' },
        { model: Institution, as: 'institution' },
      ],
    });

    if (!responses.length) {
      return res.status(404).json({ message: 'No responses found for the given note' });
    }

    return res.status(200).json({ data: responses });
  } catch (error) {
    console.error('Error fetching AI responses:', error);
    return res.status(500).json({ error: 'Failed to fetch AI responses' });
  }
};

/**
 * Fetch all AI responses for an institution
 */
exports.getResponsesByInstitution = async (req, res) => {
  const { institutionId } = req.params;

  try {
    const responses = await ChatAi.findAll({
      where: { institution_id: institutionId },
      include: [
        { model: PatientNote, as: 'patient_note' },
        { model: Institution, as: 'institution' },
      ],
    });

    if (!responses.length) {
      return res.status(404).json({ message: 'No responses found for the given institution' });
    }

    return res.status(200).json({ data: responses });
  } catch (error) {
    console.error('Error fetching AI responses by institution:', error);
    return res.status(500).json({ error: 'Failed to fetch AI responses' });
  }
};

const Joi = require('joi');
const Patient = require('../../models/patient');
const PatientNote = require('../../models/PatientNote');
const Staff = require('../../models/staff');
const Notification = require('../../models/notification');
// const generateAiResponse = require('../../utils/aiResponseGenerator');
const StaffComment = require('../../models/StaffComment');
const Visit = require('../../models/Visit');

// Define Joi schema for validation
const patientNoteSchema = Joi.object({
  visit_id: Joi.string().uuid().required(), // Ensure UUID format
  staff_id: Joi.string().uuid().required(),
  institution_id: Joi.string().uuid().required(),
  note: Joi.string().trim().min(3).required(),
  tagged_staff_ids: Joi.array().items(Joi.string().uuid()).optional(), // Ensure array of UUIDs
});

exports.createPatientNote = async (req, res) => {
  const { visit_id, staff_id, institution_id, note, tagged_staff_ids } = req.body;

  // Validate input using Joi
  const { error } = patientNoteSchema.validate({ visit_id, staff_id, institution_id, note, tagged_staff_ids });
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    // Check if patient exists within the institution
    const patient = await Visit.findOne({ where: { id: visit_id, institution_id } });
    if (!patient) return res.status(404).json({ error: "Patient not found within this institution" });

    const newNote = await PatientNote.create({ 
      visit_id, 
      staff_id, 
      institution_id, 
      note, 
      tagged_staff_ids: tagged_staff_ids // Store as JSON
    });

    return res.status(201).json({
      message: "Patient note created successfully",
      note: newNote,
    });

  } catch (err) {
    console.error("Error creating patient note:", err);
    return res.status(500).json({ error: "Failed to create patient note", details: err.message });
  }
};




exports.getPatientNotes = async (req, res) => {
  const { visit_id, institution_id } = req.query;

  try {
      // const patient = await Visit.findAll({ where: { id: visit_id, institution_id } });
      // if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const notes = await PatientNote.findAll({
          where: { visit_id },
          include: [
              {
                  model: Staff,
                  as: 'staff',
              },
              {
                  model: StaffComment,
                  as: 'comments',
                  include: [
                      {
                          model: Staff,
                          as: 'author',
                          attributes: ['id', 'firstName', 'lastName', 'middleName', 'profile_pic']
                      }
                  ]
              },
          ],
      });

      // Fetch tagged staff details for each note
      const notesWithTaggedStaff = await Promise.all(
          notes.map(async (note) => {
              const taggedStaffDetails = await Staff.findAll({
                  where: { id: note.tagged_staff_ids },
                  attributes: ['id', 'firstName', 'lastName', 'email'],
              });

              return {
                  ...note.toJSON(),
                  taggedStaffs: taggedStaffDetails, // Replace UUIDs with full staff details
              };
          })
      );

      return res.status(200).json(notesWithTaggedStaff);
  } catch (error) {
      console.error('Error retrieving patient notes:', error);
      return res.status(500).json({ error: 'Failed to retrieve patient notes', details: error.message });
  }
};


  

  exports.updatePatientNote = async (req, res) => {
    const { note_id } = req.params;
    const { note } = req.body;
  
    try {
      const existingNote = await PatientNote.findOne({ where: { id: note_id } });
      if (!existingNote) return res.status(404).json({ error: 'Note not found' });
  
      // Update the note
      existingNote.note = note;
      await existingNote.save();
  
      return res.status(200).json({ message: 'Note updated successfully', note: existingNote });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update note', details: error.message });
    }
  };
  
  exports.deletePatientNote = async (req, res) => {
    const { note_id } = req.params;
  
    try {
      const note = await PatientNote.findOne({ where: { id: note_id } });
      if (!note) return res.status(404).json({ error: 'Note not found' });
  
      // Delete the note
      await note.destroy();
      return res.status(200).json({ message: 'Note deleted successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete note', details: error.message });
    }
  };
  

  // add comments to patient notes
  exports.addCommentToNote = async (req, res) => {
    const { comment, staff_id, patient_note_id } = req.body;

    try {
      const note = await PatientNote.findOne({ where: { id: patient_note_id } });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      // Create a new comment
      const newComment = await StaffComment.create({
        patient_note_id: patient_note_id,
        staff_id,
        comment
      });

      // Fetch the comment with author details for the response
      const commentWithAuthor = await StaffComment.findByPk(newComment.id, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'firstName', 'lastName', 'middleName', 'profile_pic', 'email']
          }
        ]
      });

      // Create notification for the note owner if it's not the same person
      const noteOwnerId = note.staff_id;
      if (noteOwnerId && noteOwnerId !== staff_id) {
        const currentUser = await Staff.findByPk(staff_id);
        
        if (currentUser) {
          const notification = await Notification.create({
            title: 'New Comment on Your Patient Note',
            description: `Staff ${currentUser.firstName} ${currentUser.middleName || ''} ${currentUser.lastName} commented on your note: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`,
            from_staff_id: staff_id,
            to_staff_id: noteOwnerId,
            institution_id: currentUser.institution_id,
            type: 'Patient_Note_Comment',
            priority: 'Medium',
          });

          // Try to emit real-time notification
          try {
            const notificationService = req.app.get('notificationService');
            if (notificationService) {
              notificationService.emitNotification(notification);
            }
          } catch (notifyError) {
            console.error('Error emitting real-time notification:', notifyError);
          }
        }
      }

      return res.status(201).json({ message: 'Comment added successfully', comment: commentWithAuthor });
    } catch (error) {
      console.error('Error adding comment to note:', error);
      return res.status(500).json({ error: 'Failed to add comment', details: error.message });
    }
  }





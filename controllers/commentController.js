const Notification = require('../models/notification');
const PatientNote = require('../models/PatientNote');
const Staff = require('../models/staff');
const StaffComment = require('../models/StaffComment');
const sendEmail = require('../service/sendEmail');

// Add a new comment
async function addComment(req, res) {
  try {
    const { patient_note_id, comment, staff_id } = req.body;

    // Validate required fields
    if (!patient_note_id || !comment || !staff_id) {
      return res.status(400).json({ error: 'Missing required fields: patient_note_id, comment, and staff_id are required.' });
    }

    // Create the comment
    const newComment = await StaffComment.create({
      patient_note_id,
      staff_id,
      comment,
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

    // Get the patient note with its owner
    const patientNote = await PatientNote.findByPk(patient_note_id, {
      include: [{ model: Staff, as: 'staff', attributes: ['id'] }],
    });

    const currentUser = await Staff.findByPk(staff_id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User does not exist' });
    }

    // Create notification for the note owner if it's not the same person
    if (patientNote && patientNote.staff) {
      const noteOwnerId = patientNote.staff.id;

      // Only notify if the commenter is not the note owner
      if (noteOwnerId !== staff_id) {
        const noteOwner = await Staff.findByPk(noteOwnerId);

        // Create notification in database
        const notification = await Notification.create({
          title: 'New Comment on Your Patient Note',
          description: `Staff ${currentUser.firstName} ${currentUser.middleName || ''} ${currentUser.lastName} commented on your note: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`,
          from_staff_id: staff_id,
          to_staff_id: noteOwnerId,
          institution_id: currentUser.institution_id,
          type: 'Comment',
          priority: 'Medium',
        });

        // Try to emit real-time notification via NotificationService
        try {
          const notificationService = req.app.get('notificationService');
          if (notificationService) {
            notificationService.emitNotification(notification);
            console.log(`📣 Real-time notification emitted for comment on note ${patient_note_id}`);
          }
        } catch (notifyError) {
          console.error('Error emitting real-time notification:', notifyError);
          // Continue even if real-time notification fails - the notification is saved in DB
        }

        // Optional: Send email notification (commented out as per original code)
        // await sendEmail(
        //   noteOwner.email,
        //   'New Comment on Your Patient Note',
        //   'comments-email-alert',
        //   {
        //     noteOwner,
        //     commenter: currentUser,
        //     patient: { name: 'Patient Name' },
        //     comment: newComment.comment,
        //     institutionUrl: 'https://yourinstitution.com',
        //   }
        // );
      }
    }

    return res.status(201).json({ 
      message: 'Comment added successfully.', 
      comment: commentWithAuthor 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ error: 'Failed to add comment.', details: error.message });
  }
}

// Edit a comment
async function editComment(req, res) {
  try {
    const { comment_id } = req.params;
    const { comment } = req.body;
    const staff_id = req.user.id; // Assuming logged-in staff ID is in req.user

    // Find the comment
    const existingComment = await StaffComment.findByPk(comment_id);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Check if the logged-in user is the owner of the comment
    if (existingComment.staff_id !== staff_id) {
      return res.status(403).json({ error: 'You are not authorized to edit this comment.' });
    }

    // Update the comment
    existingComment.comment = comment;
    await existingComment.save();

    return res.status(200).json({ message: 'Comment updated successfully.', comment: existingComment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to edit comment.' });
  }
}

// Delete a comment
async function deleteComment(req, res) {
  try {
    const { comment_id } = req.params;
    const staff_id = req.user.id; // Assuming logged-in staff ID is in req.user

    // Find the comment
    const existingComment = await StaffComment.findByPk(comment_id);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Check if the logged-in user is the owner of the comment
    if (existingComment.staff_id !== staff_id) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    // Delete the comment
    await existingComment.destroy();

    return res.status(200).json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
}


// Fetch comments by note_id
async function getCommentsByNoteId(req, res) {
  try {
    const { note_id } = req.query;

    // Fetch all comments for the specified note_id, including the staff details (author)
    const comments = await StaffComment.findAll({
      where: {
        patient_note_id: note_id,
      },
      include: [
        {
          model: Staff,
          as:'author'
          
        },
      ],
      order: [['createdAt', 'DESC']], // Order by most recent first
    });


    return res.status(200).json({ comments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch comments.' });
  }
}


module.exports = {
  addComment,
  editComment,
  deleteComment,
  getCommentsByNoteId
};

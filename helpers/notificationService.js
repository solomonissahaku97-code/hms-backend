const Notification = require('../models/notification');
const { clients } = require('./authenticateHandler');

const createNotification = async ({description,title,fromDepartmentId,toDepartmentId,institutionId}) => {
    return await Notification.create({
        title: title,
        description: description,
        time: new Date(),
        from_department_id: fromDepartmentId,
        to_department_id: toDepartmentId,
        institution_id: institutionId,
        is_read: false,
    });
};

  const notifyCommentOnPatientNote = async (commentingNurseId, originalNoteNurseId, noteId)=> {
    await Notification.create({
      title: 'New Comment on Patient Note',
      description: `A new comment was added to your patient note with ID ${noteId}.`,
      from_staff_id: commentingNurseId,
      to_staff_id: originalNoteNurseId,
      type: 'Comment',
    });
  }

  async function broadcastAdminNotification(adminId, title, description,institution_id) {
    await Notification.create({
      title: title,
      description: description,
      from_staff_id: adminId,
      broadcast: true,
      type: 'System',
      institution_id
    });
  }


  async function notifyDepartmentOnPatientAdmission(departmentId, patientId,institution_id) {
  await Notification.create({
    title: 'New Patient Admission',
    description: `A new patient with ID ${patientId} has been admitted to your department.`,
    to_department_id: departmentId,
    type: 'Alert',
  });
}

  
  

module.exports = {
    createNotification,
    broadcastAdminNotification,
    notifyDepartmentOnPatientAdmission,
    notifyCommentOnPatientNote,
    
   
};

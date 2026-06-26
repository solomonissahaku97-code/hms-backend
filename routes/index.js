const authRoutes = require('./authRoutes');
const recordOfficerRoutes = require('./recordOfficerRoute');
const vitalSignsRoutes = require('./vitalSignsRoutes');
const appointmentRoutes = require('./shdeduleAppointmentRoute');
const lab = require('./labRoutes');
const prescriptionRoutes = require('./prescriptionRoute');
const notificationRoutes = require('./notificationRoutes');
const messageRoutes = require('./messageRoute');
const messageTemplate = require('./messageTempRoute')
const departmentRoutes = require('./departmentRoutes');
const institutionRoutes = require('./institutionRoutes');
const diagnosisRoutes = require('./patientDiagnosisRoutes');
const transferRoutes = require('./transferRoutes');
const accessControlRoutes = require('./accessControlRoutes');
const admissionRoutes = require('./admissionRoute');
const permissionRoutes = require('./permissionRoute');
const wardRoutes = require('./wardsRoutes');
const treatmentPlanRoutes = require('./treatmentPlanRoutes');
const requestItemsRoutes = require('./requestRoutes');
const groupRoutes = require('./groupRoutes');
const serviceRoutes = require('./serviceRoutes');
const storeRoutes = require('./storeRoutes');
const bedRoutes = require('./bedRoutes');
const patientNoteRoutes = require('./patientNoteRoute');
const paymentMethodRoute = require('./paymentMethodRoute')
const patientCarePlanRoute = require('./patientCarePlanRoutes')
const recentChats = require('./chatRoutes')
const shift = require('./rotationRoutes')
const comments = require('./commentsRoutes')
const meeting = require('./meetingRoutes')
const departmentCallRoutes = require('./departmentCallRoutes')
const partograph = require('./partographRoute')
const statistics = require('./statisticsRoutes')
const subscription = require('./subscriptionRoutes')
const summaryRoutes = require('./SummaryControllerRoutes')
const patientBookings = require('./patientBookingRoutes')
const referrals = require('./RerralRoutes')
const waitList = require('./waitListRoutes')
const procedureRoute = require('./procedureRoutes')
const ANC = require('./ANCRoute')
const consultationRoute = require('./consultationRoutes')
const qrAttendanceRoute = require('./attendanceRoutes')
const dishcargeRoute = require('./dischargeRoute')
const gdrg_codes = require('./gdrgRoutes');
const claims_medications = require('./claimsMedicineRoutes')
const icd10Codes = require('./icd10Routes');
const clinicalInterventionRoutes = require('./clinicalInterventionRoutes')
const labInvestigationRoutes = require('./labInvestigationRoute')
const claimRoutes = require('./claimsRoute')
const fluidMoniteringRoutes = require('./fluidMonitoring')
const accountsRoutes = require('./accounts.routes')
const faceRecognition = require('./faceRoutes.routes')
const nhia_vettingRoutes = require('./nhiaVettingRoutes');
const invoiceRoutes  = require('./invoice.routes')
const leaveRoutes = require('./leaveRoutes.routes');
const ultrasoundRoutes = require('./ultrasoundRoutes');
const informationManager = require('./information_manager.route')
const nursesHandoverRoutes = require('./nurseHandoverRoutes')
const theatreRoute = require('./theatrePatientRoutes')
const claimsRoute = require('./claimsRoute')
const preOpChecklistRoutes = require('./preOpChecklistRoutes')
const educationMaterialsRoutes = require('./educationMaterialsRoutes')
const operatingRoomRoutes = require('./theatre/operatingRoomRoutes')
const theatreBookingRoutes = require('./theatre/theatreBookingRoutes')
const equipmentRoutes = require('./theatre/equipmentRoutes')
const caseCartRoutes = require('./theatre/caseCartRoutes')
const doctorsNote = require('./doctorsNoteRoutes')
const drugHistoryRoutes = require('./drugHistory.routes')
const pastMedicalHistoryRoutes = require('./pastMedicalHistory.routes')
const occupationHistory = require('./patientOccupationHistory.routes')
const allergyRoutes = require('./patientAllergy.routes')
const chronicConditionRoutes = require('./patientChronicCondition.routes')
const riskAssessmentRoutes = require('./patientRiskAssessment.routes')
const familyHistoryRoutes = require('./familyHealthHistory.routes')
const advancedFeaturesRoutes = require('./patientAdvancedFeatures.routes')
const systemRoutes = require('./systemRoutes')
const scheduleRoutes = require('./scheduleRoutes')
const staffDocumentsRoutes = require('./staffDocuments.route')

// middle ware

module.exports = (app) => {
    // Define all your routes here
    app.use('/api/v1/interventions',clinicalInterventionRoutes);
    app.use('/api/v1/occupation-history',occupationHistory);
    app.use('/api/v1/theatre/pre-op-checklist',preOpChecklistRoutes);
    app.use('/api/v1/theatre/education',educationMaterialsRoutes);
    app.use('/api/v1/theatre/operating-rooms', operatingRoomRoutes);
    app.use('/api/v1/theatre', theatreBookingRoutes);
    app.use('/api/v1/theatre', equipmentRoutes);
    app.use('/api/v1/theatre', caseCartRoutes);
    app.use('/api/v1', invoiceRoutes);
    app.use('/api/v1/claims',claimsRoute)
    app.use('/api/v1/theatre',theatreRoute)
    app.use('/api/v1', informationManager);
    app.use('/api/v1/leave', leaveRoutes);
    app.use('/api/v1/ultrasound', ultrasoundRoutes);
    app.use('/api/v1/nurse-handovers',nursesHandoverRoutes)
     // AUTHENTICATION ROUTES
    app.use('/api/v1/auth', authRoutes);
       app.use('/api/v1/nhia-vetting', nhia_vettingRoutes);
    app.use('/api/v1/staff-faces',faceRecognition)
    app.use('/api/v1/accounts',accountsRoutes),
    app.use('/api/v1/fluid-monitoring', fluidMoniteringRoutes);
    app.use('/api/v1/claim-items',claimRoutes)
     app.use('/api/v1/lab-investigations', labInvestigationRoutes);
    app.use('/api/v1/icd10', icd10Codes);
    app.use('/api/v1/claims/medications', claims_medications);
    app.use('/api/v1/gdrg', gdrg_codes);
    app.use('/api/v1/attendance', qrAttendanceRoute);
    app.use('/api/v1', referrals);
    app.use('/api/v1/discharge', dishcargeRoute);
    app.use('/api/v1/consultation', consultationRoute);
    app.use('/api/v1/doctor',doctorsNote);
    app.use('/api/v1', procedureRoute);
    app.use('/api/v1/ANC', ANC)
    app.use('/api/v1', waitList);
    app.use('/api/v1', subscription);
    app.use('/api/v1', patientBookings);
    app.use('/api/v1/records', recordOfficerRoutes);
    app.use('/api/v1', vitalSignsRoutes);
    app.use('/api/v1', appointmentRoutes);
    app.use('/api/v1', scheduleRoutes);
    app.use('/api/v1/staff-documents', staffDocumentsRoutes);



    app.use('/api/v1/prescriptions', prescriptionRoutes);
    app.use('/api/v1', messageTemplate);
    app.use('/api/v1/notifications', notificationRoutes);
    app.use('/api/v1', accessControlRoutes);
    app.use('/api/v1/admission', admissionRoutes);
    app.use('/api/v1/wards', wardRoutes);
    app.use('/api/v1', serviceRoutes);
    app.use('/api/v1/treatment', treatmentPlanRoutes);
    app.use('/api/v1/store', storeRoutes);
    app.use('/api/v1', requestItemsRoutes);
    app.use('/api/v1/beds', bedRoutes);
    app.use('/api/v1/patient-note', patientNoteRoutes);
    app.use('/api/v1', groupRoutes);
    app.use('/api/v1/payment', paymentMethodRoute);
    app.use('/api/v1/care-plan', patientCarePlanRoute);
    app.use('/api/v1/chats', recentChats);
    app.use('/api/v1/shifts', shift);
    app.use('/api/v1/note', comments);
    app.use('/api/v1/meetings', meeting);
    app.use('/api/v1/department-calls', departmentCallRoutes);
    app.use('/api/v1/partograph', partograph);
    app.use('/api/v1/', statistics);
    app.use('/api/v1', summaryRoutes);


    // MESSAGES
    app.use('/api/v1/messages', messageRoutes);

    // LAB TEST ROUTE
    app.use('/api/v1/lab',lab );

    // DEPARTMENT CREATION  
    app.use('/api/v1', departmentRoutes);

    // INSTITUTION ROUTES
    app.use('/api/v1', institutionRoutes);

    // DIAGNOSIS
    app.use('/api/v1/diagnosis', diagnosisRoutes);

    // DRUG HISTORY
    app.use('/api/v1/drug-history', drugHistoryRoutes);

    // PAST MEDICAL HISTORY
    app.use('/api/v1/past-medical-history', pastMedicalHistoryRoutes);

    // ALLERGY
    app.use('/api/v1/allergies', allergyRoutes);
    
    // CHRONIC CONDITIONS
    app.use('/api/v1/chronic-conditions', chronicConditionRoutes);
    
    // RISK ASSESSMENTS
    app.use('/api/v1/risk-assessments', riskAssessmentRoutes);
    
    // FAMILY HEALTH HISTORY
    app.use('/api/v1/family-history', familyHistoryRoutes);
    
    // ADVANCED PATIENT FEATURES
    app.use('/api/v1/patient-advanced', advancedFeaturesRoutes);

    app.use('/api/v1/transfers', transferRoutes);
    app.use('/api/v1/admin', permissionRoutes);
    
    // SYSTEM MANAGEMENT (Backup, Health, Dashboard Stats)
    app.use('/api/v1/system', systemRoutes);
};

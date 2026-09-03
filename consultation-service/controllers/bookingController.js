const { sequelize, DoctorAvailability, PatientAppointment } = require('../models');
const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sendPush, notifyAppointment } = require('../helpers/notify');

// ────────────────────────────────────────────────────────────────
// Helper: get patient_id from the JWT user
// ────────────────────────────────────────────────────────────────
async function resolvePatientId(user) {
  if (!user) return null;

  // Service-to-service calls include X-Patient-Id header
  if (user.id === 'system') return null;

  // Patient JWT: resolve via users table → patients table
  const [patient] = await sequelize.query(
    `SELECT p.id
     FROM patients p
     INNER JOIN users u ON u.staff_id_code = p.folder_number
     WHERE u.id = :userId AND u.user_type = 'PATIENT'`,
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );
  return patient?.id || null;
}

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/institutions
// Returns institutions that have consultation departments + doctors
// ────────────────────────────────────────────────────────────────
exports.getInstitutions = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const patientLat = lat ? parseFloat(lat) : null;
    const patientLng = lng ? parseFloat(lng) : null;

    const institutions = await sequelize.query(`
      SELECT DISTINCT ON (i.id)
        i.id,
        i.name,
        i.address,
        i.contact,
        i.email,
        i.logo_url,
        i.region,
        i.country,
        i.opening_hours,
        i.description,
        i.short_description,
        i.latitude,
        i.longitude
      FROM institutions i
      INNER JOIN doctor_availability da ON da.institution_id = i.id AND da.is_active = true
      WHERE i."deletedAt" IS NULL
      ORDER BY i.id, i.name ASC
    `, { type: QueryTypes.SELECT });

    // Compute distance if patient location is provided
    const result = institutions.map(inst => {
      const instLat = inst.latitude ? parseFloat(inst.latitude) : null;
      const instLng = inst.longitude ? parseFloat(inst.longitude) : null;
      let distance_km = null;

      if (patientLat != null && patientLng != null && instLat != null && instLng != null) {
        distance_km = haversineDistanceKm(patientLat, patientLng, instLat, instLng);
      }

      return {
        ...inst,
        latitude: instLat,
        longitude: instLng,
        distance_km: distance_km != null ? Math.round(distance_km * 10) / 10 : null,
      };
    });

    // Sort: nearest first if location available, otherwise alphabetical
    if (patientLat != null && patientLng != null) {
      result.sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;  // unknown distance goes last
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
    }

    res.json({ data: result });
  } catch (err) {
    console.error('[Booking] getInstitutions error:', err);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/institution/:institutionId/departments
// Returns consultation departments at a given institution
// ────────────────────────────────────────────────────────────────
exports.getDepartments = async (req, res) => {
  try {
    const { institutionId } = req.params;

    const departments = await sequelize.query(`
      SELECT DISTINCT
        d.id,
        d.name,
        d.description,
        d.department_number,
        d."departmentType"
      FROM departments d
      INNER JOIN doctor_availability da ON da.department_id = d.id AND da.is_active = true
      WHERE d.institution_id = :institutionId
        AND d."departmentType" = 'Consultation'
      ORDER BY d.name ASC
    `, {
      replacements: { institutionId },
      type: QueryTypes.SELECT,
    });

    res.json({ data: departments });
  } catch (err) {
    console.error('[Booking] getDepartments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/institution/:institutionId/department/:departmentId/doctors
// Returns doctors who work in the given institution/department AND have active availability
// ────────────────────────────────────────────────────────────────
exports.getDoctors = async (req, res) => {
  try {
    const { institutionId, departmentId } = req.params;

    const doctors = await sequelize.query(`
      SELECT DISTINCT
        s.id,
        s."firstName",
        s."lastName",
        s.email,
        s.phone_number,
        s.profile_pic,
        s."staffID" as staff_id,
        r.name AS role_name,
        d.name AS department_name,
        d.id AS department_id,
        i.name AS institution_name,
        i.id AS institution_id
      FROM staffs s
      INNER JOIN institutions i ON i.id = s.institution_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN roles r ON r.id = s.role_id
      INNER JOIN doctor_availability da
        ON da.doctor_id = s.id
        AND da.institution_id = :institutionId
        AND da.department_id = :departmentId
        AND da.is_active = true
      WHERE s.institution_id = :institutionId
        AND da.department_id = :departmentId
        AND i."deletedAt" IS NULL
        AND s."firstName" IS NOT NULL
        AND s."firstName" != ''
        AND LENGTH(s."firstName") < 100
      ORDER BY s."lastName" ASC, s."firstName" ASC
    `, {
      replacements: { institutionId, departmentId },
      type: QueryTypes.SELECT,
    });

    // Enrich each doctor with their available days and next available date
    const enriched = await Promise.all(doctors.map(async (doc) => {
      const avail = await sequelize.query(`
        SELECT day_of_week, MIN(start_time) AS earliest
        FROM doctor_availability
        WHERE doctor_id = :doctorId
          AND institution_id = :institutionId
          AND department_id = :departmentId
          AND is_active = true
        GROUP BY day_of_week
        ORDER BY MIN(CASE day_of_week
          WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7 END)
      `, {
        replacements: { doctorId: doc.id, institutionId, departmentId },
        type: QueryTypes.SELECT,
      });

      const availableDays = avail.map(a => a.day_of_week);

      // Find next available date
      let nextAvailable = null;
      const today = new Date();
      for (let offset = 0; offset < 14; offset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dayAvail = avail.find(a => a.day_of_week === dayName);
        if (dayAvail) {
          nextAvailable = date.toISOString().split('T')[0];
          break;
        }
      }

      return {
        ...doc,
        full_name: `Dr. ${doc.firstName} ${doc.lastName}`,
        available_days: availableDays,
        next_available_date: nextAvailable,
      };
    }));

    res.json({ data: enriched });
  } catch (err) {
    console.error('[Booking] getDoctors error:', err);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/doctor/:doctorId/availability
// Returns the full availability schedule for a doctor at an institution/department
// ────────────────────────────────────────────────────────────────
exports.getDoctorAvailability = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const { institutionId, departmentId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId query parameter is required' });
    }

    const availability = await sequelize.query(`
      SELECT
        id, day_of_week, start_time, end_time,
        slot_duration, break_start, break_end, is_active
      FROM doctor_availability
      WHERE doctor_id = :doctorId
        AND institution_id = :institutionId
        AND department_id = :departmentId
        AND is_active = true
      ORDER BY CASE day_of_week
        WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
        WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
        WHEN 'sunday' THEN 7 END,
        start_time ASC
    `, {
      replacements: { doctorId, institutionId, departmentId },
      type: QueryTypes.SELECT,
    });

    res.json({ data: availability });
  } catch (err) {
    console.error('[Booking] getDoctorAvailability error:', err);
    res.status(500).json({ error: 'Failed to fetch doctor availability' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/doctor/:doctorId/slots
// Query params: date (YYYY-MM-DD), institution_id, department_id
// Returns available time slots for a specific date
// ────────────────────────────────────────────────────────────────
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, institution_id, department_id } = req.query;

    if (!date || !institution_id || !department_id) {
      return res.status(400).json({ error: 'date, institution_id, and department_id are required' });
    }

    // Determine day of week from date
    const dateObj = new Date(date + 'T12:00:00Z');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateObj.getUTCDay()];

    // Get availability for this day
    const [availability] = await sequelize.query(`
      SELECT start_time, end_time, slot_duration, break_start, break_end
      FROM doctor_availability
      WHERE doctor_id = :doctorId
        AND institution_id = :institutionId
        AND department_id = :departmentId
        AND day_of_week = :dayOfWeek
        AND is_active = true
      LIMIT 1
    `, {
      replacements: { doctorId, institutionId: institution_id, departmentId: department_id, dayOfWeek },
      type: QueryTypes.SELECT,
    });

    if (!availability) {
      return res.json({ data: [], message: 'Doctor is not available on this day' });
    }

    // Generate all possible slots
    const allSlots = generateSlots(
      availability.start_time,
      availability.end_time,
      availability.slot_duration,
      availability.break_start,
      availability.break_end
    );

    // Get already-booked slots for this doctor/date
    const booked = await sequelize.query(`
      SELECT appointment_time
      FROM patient_appointments
      WHERE doctor_id = :doctorId
        AND appointment_date = :date
        AND status IN ('scheduled', 'confirmed')
    `, {
      replacements: { doctorId, date },
      type: QueryTypes.SELECT,
    });

    const bookedTimes = new Set(booked.map(b => b.appointment_time));

    // Filter out booked slots and past times
    const now = new Date();
    const isToday = date === now.toISOString().split('T')[0];

    const available = allSlots
      .filter(slot => !bookedTimes.has(slot))
      .filter(slot => {
        if (!isToday) return true;
        const [h, m] = slot.split(':').map(Number);
        const slotDate = new Date(dateObj);
        slotDate.setUTCHours(h, m, 0, 0);
        return slotDate > now;
      });

    res.json({ data: available });
  } catch (err) {
    console.error('[Booking] getAvailableSlots error:', err);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
};

// ────────────────────────────────────────────────────────────────
// POST /consultation/booking/appointments
// Create a new patient appointment (the main booking endpoint)
// ────────────────────────────────────────────────────────────────
exports.createAppointment = async (req, res) => {
  try {
    const {
      doctor_id,
      institution_id,
      department_id,
      appointment_date,
      appointment_time,
      reason,
      notes,
    } = req.body;

    // ── Resolve patient ──
    const patient_id = await resolvePatientId(req.user);
    if (!patient_id) {
      return res.status(401).json({ error: 'Could not resolve patient identity' });
    }

    // ── Validate required fields ──
    if (!doctor_id || !institution_id || !department_id || !appointment_date || !appointment_time) {
      return res.status(400).json({
        error: 'Missing required fields: doctor_id, institution_id, department_id, appointment_date, appointment_time',
      });
    }

    // ── Validate institution exists and is active ──
    const [institution] = await sequelize.query(
      'SELECT id, name FROM institutions WHERE id = :id AND "deletedAt" IS NULL',
      { replacements: { id: institution_id }, type: QueryTypes.SELECT }
    );
    if (!institution) {
      return res.status(400).json({ error: 'Institution not found or inactive' });
    }

    // ── Validate department belongs to institution ──
    const [department] = await sequelize.query(
      'SELECT id, name FROM departments WHERE id = :id AND institution_id = :institution_id',
      { replacements: { id: department_id, institution_id }, type: QueryTypes.SELECT }
    );
    if (!department) {
      return res.status(400).json({ error: 'Department not found at this institution' });
    }

    // ── Validate doctor belongs to institution and has availability ──
    const [doctor] = await sequelize.query(
      'SELECT id, "firstName", "lastName" FROM staffs WHERE id = :id AND institution_id = :institution_id',
      { replacements: { id: doctor_id, institution_id }, type: QueryTypes.SELECT }
    );
    if (!doctor) {
      return res.status(400).json({ error: 'Doctor not found at this institution' });
    }

    // ── Validate doctor has availability for this day/time ──
    const dateObj = new Date(appointment_date + 'T12:00:00Z');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateObj.getUTCDay()];

    const [availability] = await sequelize.query(`
      SELECT start_time, end_time, slot_duration, break_start, break_end
      FROM doctor_availability
      WHERE doctor_id = :doctorId
        AND institution_id = :institutionId
        AND department_id = :departmentId
        AND day_of_week = :dayOfWeek
        AND is_active = true
      LIMIT 1
    `, {
      replacements: { doctorId: doctor_id, institutionId: institution_id, departmentId: department_id, dayOfWeek },
      type: QueryTypes.SELECT,
    });

    if (!availability) {
      return res.status(400).json({ error: 'Doctor is not available on this day' });
    }

    // ── Validate requested time is within availability ──
    const allSlots = generateSlots(
      availability.start_time,
      availability.end_time,
      availability.slot_duration,
      availability.break_start,
      availability.break_end
    );

    if (!allSlots.includes(appointment_time)) {
      return res.status(400).json({ error: 'Selected time is not within doctor availability' });
    }

    // ── Check date is not in the past ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return res.status(400).json({ error: 'Cannot book appointments in the past' });
    }

    // ── PREVENT DOUBLE BOOKING (atomic) ──
    // Use a transaction with a unique constraint to prevent race conditions
    const transaction = await sequelize.transaction();
    try {
      // Check if slot is already booked
      const [existing] = await sequelize.query(`
        SELECT id FROM patient_appointments
        WHERE doctor_id = :doctorId
          AND appointment_date = :date
          AND appointment_time = :time
          AND status IN ('scheduled', 'confirmed')
        FOR UPDATE
      `, {
        replacements: { doctorId: doctor_id, date: appointment_date, time: appointment_time },
        type: QueryTypes.SELECT,
        transaction,
      });

      if (existing) {
        await transaction.rollback();
        return res.status(409).json({
          error: 'This appointment time is no longer available. Please select another time.',
        });
      }

      // Create the appointment
      const token = uuidv4();
      const [appointment] = await sequelize.query(`
        INSERT INTO patient_appointments
          (id, patient_id, doctor_id, institution_id, department_id,
           appointment_date, appointment_time, slot_duration,
           status, reason, notes, token, "createdAt", "updatedAt")
        VALUES
          (:id, :patient_id, :doctor_id, :institution_id, :department_id,
           :appointment_date, :appointment_time, :slot_duration,
           'scheduled', :reason, :notes, :token, NOW(), NOW())
        RETURNING *
      `, {
        replacements: {
          id: uuidv4(),
          patient_id,
          doctor_id,
          institution_id,
          department_id,
          appointment_date,
          appointment_time,
          slot_duration: availability.slot_duration,
          reason: reason || null,
          notes: notes || null,
          token,
        },
        type: QueryTypes.INSERT,
        transaction,
      });

      await transaction.commit();

      // ── Send notifications (non-blocking) ──
      const dateStr = new Date(appointment_date + 'T12:00:00Z').toLocaleDateString('en-GB', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      });
      // Find patient user ID for push notification
      const [patientUser] = await sequelize.query(
        `SELECT u.id FROM users u INNER JOIN patients p ON p.folder_number = u.staff_id_code WHERE p.id = :patientId AND u.user_type = 'PATIENT'`,
        { replacements: { patientId: patient_id }, type: QueryTypes.SELECT }
      );
      if (patientUser?.id) {
        sendPush(
          patientUser.id,
          '📅 Appointment Scheduled',
          `Your appointment with Dr. ${doctor.firstName} ${doctor.lastName} is scheduled for ${dateStr} at ${appointment_time}.`,
          'appointment',
          { appointment_id: appointment[0].id, doctor_name: `${doctor.firstName} ${doctor.lastName}` }
        );
      }
      // Notify doctor
      sendPush(
        doctor_id,
        '📅 New Appointment Booked',
        `A new appointment has been scheduled for ${dateStr} at ${appointment_time}.`,
        'appointment',
        { appointment_id: appointment[0].id, appointment_date }
      );

      // Send SMS + push confirmation to patient via notification-service
      if (patientUser?.id) {
        // Look up patient name and phone for SMS
        const [patientInfo] = await sequelize.query(
          `SELECT p.first_name, p.last_name, p.phone FROM patients p WHERE p.id = :patientId`,
          { replacements: { patientId: patient_id }, type: QueryTypes.SELECT }
        );
        const patientName = patientInfo ? `${patientInfo.first_name || ''} ${patientInfo.last_name || ''}`.trim() : 'Patient';
        const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
        const dateTimeStr = `${dateStr} at ${appointment_time}`;

        notifyAppointment({
          patient_user_id: patientUser.id,
          patient_name: patientName,
          patient_phone: patientInfo?.phone || null,
          doctor_name: doctorName,
          date_time: dateTimeStr,
        }).catch(() => {}); // fire-and-forget
      }

      return res.status(201).json({
        message: 'Appointment booked successfully',
        data: {
          id: appointment[0].id,
          appointment_date,
          appointment_time,
          doctor: `Dr. ${doctor.firstName} ${doctor.lastName}`,
          institution: institution.name,
          department: department.name,
          status: 'scheduled',
          token,
        },
      });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[Booking] createAppointment error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This appointment time is no longer available. Please select another time.' });
    }
    return res.status(500).json({ error: 'Failed to create appointment' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/appointments
// Get patient's own appointments
// ────────────────────────────────────────────────────────────────
exports.getPatientAppointments = async (req, res) => {
  try {
    const patient_id = await resolvePatientId(req.user);
    if (!patient_id) {
      return res.status(401).json({ error: 'Could not resolve patient identity' });
    }

    const { status } = req.query;
    let whereClause = 'WHERE pa.patient_id = :patientId';
    const replacements = { patientId: patient_id };

    if (status) {
      whereClause += ' AND pa.status = :status';
      replacements.status = status;
    }

    const appointments = await sequelize.query(`
      SELECT
        pa.*,
        s."firstName" AS doctor_first_name,
        s."lastName" AS doctor_last_name,
        s.profile_pic AS doctor_photo,
        d.name AS department_name,
        i.name AS institution_name,
        i.address AS institution_address
      FROM patient_appointments pa
      LEFT JOIN staffs s ON s.id = pa.doctor_id
      LEFT JOIN departments d ON d.id = pa.department_id
      LEFT JOIN institutions i ON i.id = pa.institution_id
      ${whereClause}
      ORDER BY pa.appointment_date DESC, pa.appointment_time DESC
    `, { replacements, type: QueryTypes.SELECT });

    // Separate into upcoming, past, cancelled
    const today = new Date().toISOString().split('T')[0];
    const upcoming = [];
    const past = [];
    const cancelled = [];

    for (const apt of appointments) {
      if (['cancelled'].includes(apt.status)) {
        cancelled.push(apt);
      } else if (apt.appointment_date >= today) {
        upcoming.push(apt);
      } else {
        past.push(apt);
      }
    }

    res.json({ data: { upcoming, past, cancelled, all: appointments } });
  } catch (err) {
    console.error('[Booking] getPatientAppointments error:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// ────────────────────────────────────────────────────────────────
// PATCH /consultation/booking/appointments/:id/reschedule
// Patient reschedules their own appointment to a new date/time
// ────────────────────────────────────────────────────────────────
exports.rescheduleAppointment = async (req, res) => {
  try {
    const patient_id = await resolvePatientId(req.user);
    if (!patient_id) {
      return res.status(401).json({ error: 'Could not resolve patient identity' });
    }

    const { id } = req.params;
    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'appointment_date and appointment_time are required' });
    }

    // Find the existing appointment
    const [appointment] = await sequelize.query(`
      SELECT id, status, doctor_id, institution_id, department_id,
             appointment_date, appointment_time
      FROM patient_appointments
      WHERE id = :id AND patient_id = :patientId
    `, {
      replacements: { id, patientId: patient_id },
      type: QueryTypes.SELECT,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({
        error: `Cannot reschedule an appointment with status '${appointment.status}'`,
      });
    }

    // Validate the new date is not in the past
    const newDateObj = new Date(appointment_date + 'T12:00:00Z');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDateObj < today) {
      return res.status(400).json({ error: 'Cannot reschedule to a past date' });
    }

    // Validate doctor availability for the new day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[newDateObj.getUTCDay()];

    const [availability] = await sequelize.query(`
      SELECT start_time, end_time, slot_duration, break_start, break_end
      FROM doctor_availability
      WHERE doctor_id = :doctorId
        AND institution_id = :institutionId
        AND department_id = :departmentId
        AND day_of_week = :dayOfWeek
        AND is_active = true
      LIMIT 1
    `, {
      replacements: {
        doctorId: appointment.doctor_id,
        institutionId: appointment.institution_id,
        departmentId: appointment.department_id,
        dayOfWeek,
      },
      type: QueryTypes.SELECT,
    });

    if (!availability) {
      return res.status(400).json({ error: 'Doctor is not available on the selected day' });
    }

    // Validate the new time is within availability
    const allSlots = generateSlots(
      availability.start_time, availability.end_time,
      availability.slot_duration, availability.break_start, availability.break_end
    );

    if (!allSlots.includes(appointment_time)) {
      return res.status(400).json({ error: 'Selected time is not within doctor availability' });
    }

    // Prevent double-booking on the new slot (atomic)
    const transaction = await sequelize.transaction();
    try {
      const [existing] = await sequelize.query(`
        SELECT id FROM patient_appointments
        WHERE doctor_id = :doctorId
          AND appointment_date = :date
          AND appointment_time = :time
          AND status IN ('scheduled', 'confirmed')
          AND id != :excludeId
        FOR UPDATE
      `, {
        replacements: {
          doctorId: appointment.doctor_id,
          date: appointment_date,
          time: appointment_time,
          excludeId: id,
        },
        type: QueryTypes.SELECT,
        transaction,
      });

      if (existing) {
        await transaction.rollback();
        return res.status(409).json({
          error: 'This appointment time is no longer available. Please select another time.',
        });
      }

      // Update the appointment
      await sequelize.query(`
        UPDATE patient_appointments
        SET appointment_date = :date,
            appointment_time = :time,
            status = 'scheduled',
            "updatedAt" = NOW()
        WHERE id = :id
      `, {
        replacements: { id, date: appointment_date, time: appointment_time },
        type: QueryTypes.UPDATE,
        transaction,
      });

      await transaction.commit();

      // Notify doctor
      const oldDateStr = new Date(appointment.appointment_date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const newDateStr2 = new Date(appointment_date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      sendPush(appointment.doctor_id, '📅 Appointment Rescheduled', `An appointment has been rescheduled from ${oldDateStr} ${appointment.appointment_time} to ${newDateStr2} ${appointment_time}.`, 'appointment', { appointment_id: id });

      return res.json({
        message: 'Appointment rescheduled successfully',
        data: {
          id,
          appointment_date,
          appointment_time,
        },
      });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[Booking] rescheduleAppointment error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This appointment time is no longer available. Please select another time.' });
    }
    return res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
};

// ────────────────────────────────────────────────────────────────
// PATCH /consultation/booking/appointments/:id/cancel
// Patient cancels their own appointment
// ────────────────────────────────────────────────────────────────
exports.cancelAppointment = async (req, res) => {
  try {
    const patient_id = await resolvePatientId(req.user);
    if (!patient_id) {
      return res.status(401).json({ error: 'Could not resolve patient identity' });
    }

    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const [appointment] = await sequelize.query(`
      SELECT id, status, doctor_id, appointment_date
      FROM patient_appointments
      WHERE id = :id AND patient_id = :patientId
    `, {
      replacements: { id, patientId: patient_id },
      type: QueryTypes.SELECT,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Appointment is already cancelled' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed appointment' });
    }

    await sequelize.query(`
      UPDATE patient_appointments
      SET status = 'cancelled',
          cancelled_by = 'patient',
          cancellation_reason = :reason,
          "updatedAt" = NOW()
      WHERE id = :id
    `, {
      replacements: { id, reason: cancellation_reason || null },
      type: QueryTypes.UPDATE,
    });

    // Notify doctor
    const cancelDateStr = new Date(appointment.appointment_date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    sendPush(appointment.doctor_id, '📅 Appointment Cancelled', `A patient has cancelled their appointment scheduled for ${cancelDateStr}.`, 'appointment', { appointment_id: id });

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error('[Booking] cancelAppointment error:', err);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/appointments/:id
// Get a single appointment detail
// ────────────────────────────────────────────────────────────────
exports.getAppointmentDetail = async (req, res) => {
  try {
    const patient_id = await resolvePatientId(req.user);
    if (!patient_id) {
      return res.status(401).json({ error: 'Could not resolve patient identity' });
    }

    const { id } = req.params;

    const [appointment] = await sequelize.query(`
      SELECT
        pa.*,
        s."firstName" AS doctor_first_name,
        s."lastName" AS doctor_last_name,
        s.profile_pic AS doctor_photo,
        s.email AS doctor_email,
        d.name AS department_name,
        i.name AS institution_name,
        i.address AS institution_address,
        i.contact AS institution_contact
      FROM patient_appointments pa
      LEFT JOIN staffs s ON s.id = pa.doctor_id
      LEFT JOIN departments d ON d.id = pa.department_id
      LEFT JOIN institutions i ON i.id = pa.institution_id
      WHERE pa.id = :id AND pa.patient_id = :patientId
    `, {
      replacements: { id, patientId: patient_id },
      type: QueryTypes.SELECT,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ data: appointment });
  } catch (err) {
    console.error('[Booking] getAppointmentDetail error:', err);
    res.status(500).json({ error: 'Failed to fetch appointment detail' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET /consultation/booking/available-dates
// Returns dates with availability for a doctor in a date range
// ────────────────────────────────────────────────────────────────
exports.getAvailableDates = async (req, res) => {
  try {
    const { doctor_id, institution_id, department_id, year, month } = req.query;

    if (!doctor_id || !institution_id || !department_id || !year || !month) {
      return res.status(400).json({ error: 'doctor_id, institution_id, department_id, year, month are required' });
    }

    // Get all active availability for this doctor/institution/department
    const avail = await sequelize.query(`
      SELECT day_of_week
      FROM doctor_availability
      WHERE doctor_id = :doctorId
        AND institution_id = :institutionId
        AND department_id = :departmentId
        AND is_active = true
    `, {
      replacements: { doctorId: doctor_id, institutionId: institution_id, departmentId: department_id },
      type: QueryTypes.SELECT,
    });

    const availableDays = new Set(avail.map(a => a.day_of_week));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Generate all dates in the month
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      const dayName = dayNames[date.getDay()];
      const dateStr = date.toISOString().split('T')[0];

      if (availableDays.has(dayName) && date >= today) {
        // Check if the doctor has any booked slots on this date
        const [booked] = await sequelize.query(`
          SELECT COUNT(*) AS booked_count
          FROM patient_appointments
          WHERE doctor_id = :doctorId
            AND appointment_date = :date
            AND status IN ('scheduled', 'confirmed')
        `, {
          replacements: { doctorId: doctor_id, date: dateStr },
          type: QueryTypes.SELECT,
        });

        // Get total slots for this day
        const [slotInfo] = await sequelize.query(`
          SELECT start_time, end_time, slot_duration, break_start, break_end
          FROM doctor_availability
          WHERE doctor_id = :doctorId
            AND institution_id = :institutionId
            AND department_id = :departmentId
            AND day_of_week = :dayOfWeek
            AND is_active = true
          LIMIT 1
        `, {
          replacements: {
            doctorId: doctor_id,
            institutionId: institution_id,
            departmentId: department_id,
            dayOfWeek: dayName,
          },
          type: QueryTypes.SELECT,
        });

        if (slotInfo) {
          const totalSlots = generateSlots(
            slotInfo.start_time, slotInfo.end_time,
            slotInfo.slot_duration, slotInfo.break_start, slotInfo.break_end
          ).length;
          const bookedCount = parseInt(booked.booked_count) || 0;
          const hasAvailable = bookedCount < totalSlots;

          dates.push({
            date: dateStr,
            available: hasAvailable,
            available_slots: totalSlots - bookedCount,
            total_slots: totalSlots,
          });
        }
      } else {
        dates.push({ date: dateStr, available: false, available_slots: 0, total_slots: 0 });
      }
    }

    res.json({ data: dates });
  } catch (err) {
    console.error('[Booking] getAvailableDates error:', err);
    res.status(500).json({ error: 'Failed to fetch available dates' });
  }
};

// ────────────────────────────────────────────────────────────────
// Doctor Availability Management (for doctor_app or admin)
// ────────────────────────────────────────────────────────────────

exports.createAvailability = async (req, res) => {
  try {
    const {
      doctor_id, institution_id, department_id,
      day_of_week, start_time, end_time,
      slot_duration, break_start, break_end,
    } = req.body;

    if (!doctor_id || !institution_id || !department_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await sequelize.query(`
      INSERT INTO doctor_availability
        (id, doctor_id, institution_id, department_id, day_of_week,
         start_time, end_time, slot_duration, break_start, break_end,
         is_active, "createdAt", "updatedAt")
      VALUES
        (:id, :doctor_id, :institution_id, :department_id, :day_of_week,
         :start_time, :end_time, :slot_duration, :break_start, :break_end,
         true, NOW(), NOW())
      RETURNING *
    `, {
      replacements: {
        id: uuidv4(),
        doctor_id, institution_id, department_id,
        day_of_week, start_time, end_time,
        slot_duration: slot_duration || 30,
        break_start: break_start || null,
        break_end: break_end || null,
      },
      type: QueryTypes.INSERT,
    });

    res.status(201).json({ message: 'Availability created', data: result[0] });
  } catch (err) {
    console.error('[Booking] createAvailability error:', err);
    res.status(500).json({ error: 'Failed to create availability' });
  }
};

exports.getMyAvailability = async (req, res) => {
  try {
    const { doctor_id, institution_id, department_id } = req.query;

    if (!doctor_id) {
      return res.status(400).json({ error: 'doctor_id is required' });
    }

    let whereClause = 'WHERE doctor_id = :doctor_id';
    const replacements = { doctor_id };

    if (institution_id) {
      whereClause += ' AND institution_id = :institution_id';
      replacements.institution_id = institution_id;
    }
    if (department_id) {
      whereClause += ' AND department_id = :department_id';
      replacements.department_id = department_id;
    }

    const availability = await sequelize.query(`
      SELECT * FROM doctor_availability
      ${whereClause}
      ORDER BY CASE day_of_week
        WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
        WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
        WHEN 'sunday' THEN 7 END,
        start_time ASC
    `, { replacements, type: QueryTypes.SELECT });

    res.json({ data: availability });
  } catch (err) {
    console.error('[Booking] getMyAvailability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['day_of_week', 'start_time', 'end_time', 'slot_duration', 'break_start', 'break_end', 'is_active'];
    const setClauses = [];
    const replacements = { id };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`"${field}" = :${field}`);
        replacements[field] = updates[field];
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('"updatedAt" = NOW()');

    const [updated] = await sequelize.query(`
      UPDATE doctor_availability
      SET ${setClauses.join(', ')}
      WHERE id = :id
      RETURNING *
    `, { replacements, type: QueryTypes.UPDATE });

    res.json({ message: 'Availability updated', data: updated[0] });
  } catch (err) {
    console.error('[Booking] updateAvailability error:', err);
    res.status(500).json({ error: 'Failed to update availability' });
  }
};

exports.deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    await sequelize.query(`
      UPDATE doctor_availability SET is_active = false, "updatedAt" = NOW()
      WHERE id = :id
    `, { replacements: { id }, type: QueryTypes.UPDATE });

    res.json({ message: 'Availability deactivated' });
  } catch (err) {
    console.error('[Booking] deleteAvailability error:', err);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
};

// ────────────────────────────────────────────────────────────────
// Helper: Haversine distance between two coordinates (in km)
// ────────────────────────────────────────────────────────────────
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ────────────────────────────────────────────────────────────────
// Helper: generate time slots from availability window
// ────────────────────────────────────────────────────────────────
function generateSlots(startTime, endTime, durationMinutes, breakStart, breakEnd) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const breakStartMinutes = breakStart ? (() => {
    const [h, m] = breakStart.split(':').map(Number);
    return h * 60 + m;
  })() : null;

  const breakEndMinutes = breakEnd ? (() => {
    const [h, m] = breakEnd.split(':').map(Number);
    return h * 60 + m;
  })() : null;

  while (currentMinutes + durationMinutes <= endMinutes) {
    // Skip break period
    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
        currentMinutes = breakEndMinutes;
        continue;
      }
    }

    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

#!/usr/bin/env node
/**
 * Seed Doctor Availability
 *
 * Queries the shared HMS database for institutions, consultation departments,
 * and staff (doctors), then creates realistic availability schedules for
 * testing the patient appointment booking flow end-to-end.
 *
 * Usage:
 *   node scripts/seedDoctorAvailability.js          # seed all doctors
 *   node scripts/seedDoctorAvailability.js --dry-run # preview without writing
 *   node scripts/seedDoctorAvailability.js --clear   # remove all availability records
 *
 * The script is idempotent: it skips doctors that already have availability.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// ── Database connection ──────────────────────────────────────────
const sequelize = new Sequelize(
  process.env.DB_NAME || 'hms',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
  }
);

// ── Doctor Availability model (inline to avoid circular deps) ────
const DoctorAvailability = sequelize.define('DoctorAvailability', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  doctor_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID, allowNull: false },
  day_of_week: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: false,
  },
  start_time: { type: DataTypes.STRING(5), allowNull: false },
  end_time: { type: DataTypes.STRING(5), allowNull: false },
  slot_duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  break_start: { type: DataTypes.STRING(5), allowNull: true },
  break_end: { type: DataTypes.STRING(5), allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'doctor_availability',
  timestamps: true,
});

// ── Schedule templates ────────────────────────────────────────────
// Each template is a set of weekly sessions a doctor might have.
// We cycle through these when assigning to doctors.

const SCHEDULES = [
  // Morning-only clinician (Mon–Fri, 8am–12pm, 30min slots)
  {
    label: 'Morning clinic (Mon–Fri)',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    start: '08:00',
    end: '12:00',
    duration: 30,
    breakStart: null,
    breakEnd: null,
  },
  // Full-day clinician (Mon–Wed–Fri, 8am–5pm with lunch break)
  {
    label: 'Full day (Mon/Wed/Fri)',
    days: ['monday', 'wednesday', 'friday'],
    start: '08:00',
    end: '17:00',
    duration: 30,
    breakStart: '12:00',
    breakEnd: '13:00',
  },
  // Half-day afternoon (Tue–Thu, 1pm–5pm)
  {
    label: 'Afternoon (Tue/Thu)',
    days: ['tuesday', 'thursday'],
    start: '13:00',
    end: '17:00',
    duration: 30,
    breakStart: null,
    breakEnd: null,
  },
  // Morning + afternoon (Mon–Fri, 9am–12pm, 2pm–5pm) — two sessions
  {
    label: 'Split day (Mon–Fri)',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    start: '09:00',
    end: '12:00',
    duration: 30,
    breakStart: '12:00',
    breakEnd: '14:00',
  },
  // Extended morning (Mon–Thu, 7:30am–12:30pm, 45min slots)
  {
    label: 'Early bird (Mon–Thu)',
    days: ['monday', 'tuesday', 'wednesday', 'thursday'],
    start: '07:30',
    end: '12:30',
    duration: 45,
    breakStart: null,
    breakEnd: null,
  },
  // Weekend clinic (Sat, 9am–1pm)
  {
    label: 'Saturday clinic',
    days: ['saturday'],
    start: '09:00',
    end: '13:00',
    duration: 30,
    breakStart: null,
    breakEnd: null,
  },
];

// ── Helpers ──────────────────────────────────────────────────────

function pick(arr, index) {
  return arr[index % arr.length];
}

function log(msg) {
  console.log(msg);
}

function logDry(msg) {
  console.log(`[DRY RUN] ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────

async function seed() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const clear = args.includes('--clear');

  await sequelize.authenticate();
  log('✅ Connected to database\n');

  // Sync the doctor_availability table if it doesn't exist
  try {
    await DoctorAvailability.sync({ alter: false });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      // Table exists, that's fine
    } else {
      throw err;
    }
  }

  // ── Clear mode ──────────────────────────────────────────────
  if (clear) {
    const count = await DoctorAvailability.count();
    if (dryRun) {
      logDry(`Would delete ${count} availability records`);
    } else {
      await DoctorAvailability.destroy({ where: {} });
      log(`🗑️  Deleted ${count} doctor availability records`);
    }
    await sequelize.close();
    return;
  }

  // ── Find institutions with consultation departments ─────────
  // Use a safe query — institutions may or may not have deleted_at (paranoid)
  let institutions;
  try {
    institutions = await sequelize.query(`
      SELECT DISTINCT i.id, i.name
      FROM institutions i
      INNER JOIN departments d ON d.institution_id = i.id AND d."departmentType" = 'Consultation'
      WHERE i."deletedAt" IS NULL
      ORDER BY i.name
    `, { type: QueryTypes.SELECT });
  } catch (_) {
    // Table may not have deleted_at column — fall back
    institutions = await sequelize.query(`
      SELECT DISTINCT i.id, i.name
      FROM institutions i
      INNER JOIN departments d ON d.institution_id = i.id AND d."departmentType" = 'Consultation'
      ORDER BY i.name
    `, { type: QueryTypes.SELECT });
  }

  if (institutions.length === 0) {
    log('⚠️  No institutions with consultation departments found.');
    log('   Create institutions and consultation departments first.\n');
    log('   You can create a department with departmentType = \'Consultation\' via the admin UI.');
    await sequelize.close();
    return;
  }

  log(`Found ${institutions.length} institution(s) with consultation departments:`);
  institutions.forEach(i => log(`  • ${i.name} (${i.id})`));
  log('');

  // ── For each institution, find consultation departments + staff
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const institution of institutions) {
    // Find consultation departments
    let departments;
    try {
      departments = await sequelize.query(`
        SELECT d.id, d.name
        FROM departments d
        WHERE d.institution_id = :institutionId AND d."departmentType" = 'Consultation'
        ORDER BY d.name
      `, {
        replacements: { institutionId: institution.id },
        type: QueryTypes.SELECT,
      });
    } catch (_) {
      // departmentType enum may not exist — fall back to name-based match
      departments = await sequelize.query(`
        SELECT d.id, d.name
        FROM departments d
        WHERE d.institution_id = :institutionId
          AND (LOWER(d.name) LIKE '%consult%' OR LOWER(d.name) LIKE '%opd%' OR LOWER(d.name) LIKE '%general%')
        ORDER BY d.name
      `, {
        replacements: { institutionId: institution.id },
        type: QueryTypes.SELECT,
      });
    }

    if (departments.length === 0) {
      log(`  ⚠️  ${institution.name}: No consultation departments found, skipping`);
      continue;
    }

    log(`📋 ${institution.name}: ${departments.length} consultation department(s)`);

    for (const dept of departments) {
      // Find staff in this department (or in this institution with no department assignment)
      let staff;
      try {
        staff = await sequelize.query(`
          SELECT s.id, s."firstName", s."lastName", s.role_id, r.name AS role_name
          FROM staffs s
          LEFT JOIN roles r ON r.id = s.role_id
          WHERE s.institution_id = :institutionId
            AND (s.department_id = :departmentId OR s.department_id IS NULL)
          ORDER BY s."lastName" ASC
        `, {
          replacements: { institutionId: institution.id, departmentId: dept.id },
          type: QueryTypes.SELECT,
        });
      } catch (_) {
        // Roles table may not exist in consultation-service DB — skip role join
        staff = await sequelize.query(`
          SELECT s.id, s."firstName", s."lastName", s.role_id, NULL AS role_name
          FROM staffs s
          WHERE s.institution_id = :institutionId
            AND (s.department_id = :departmentId OR s.department_id IS NULL)
          ORDER BY s."lastName" ASC
        `, {
          replacements: { institutionId: institution.id, departmentId: dept.id },
          type: QueryTypes.SELECT,
        });
      }

      if (staff.length === 0) {
        log(`    ⚠️  ${dept.name}: No staff found, skipping`);
        continue;
      }

      log(`    👨‍⚕️ ${dept.name}: ${staff.length} staff member(s)`);

      // Check which staff already have availability
      const staffIds = staff.map(s => s.id);
      let existingDoctorIds = new Set();
      try {
        const existing = await sequelize.query(`
          SELECT doctor_id FROM doctor_availability
          WHERE doctor_id IN (:staffIds)
          GROUP BY doctor_id
        `, {
          replacements: { staffIds },
          type: QueryTypes.SELECT,
        });
        existingDoctorIds = new Set(existing.map(e => e.doctor_id));
      } catch (_) {
        // Table may not exist yet — no existing records
      }

      // Assign availability to each staff member
      for (let i = 0; i < staff.length; i++) {
        const member = staff[i];
        const name = `${member.firstName} ${member.lastName}`;

        if (existingDoctorIds.has(member.id)) {
          log(`      ⏭️  ${name}: Already has availability, skipping`);
          totalSkipped++;
          continue;
        }

        // Pick a schedule template (cycle through them)
        const schedule = pick(SCHEDULES, i);

        if (dryRun) {
          logDry(`      Would create ${schedule.days.length} availability records for ${name} (${schedule.label}): ${schedule.start}–${schedule.end}`);
          totalCreated += schedule.days.length;
          continue;
        }

        // Create availability records for each day
        const records = schedule.days.map(day => ({
          id: uuidv4(),
          doctor_id: member.id,
          institution_id: institution.id,
          department_id: dept.id,
          day_of_week: day,
          start_time: schedule.start,
          end_time: schedule.end,
          slot_duration: schedule.duration,
          break_start: schedule.breakStart,
          break_end: schedule.breakEnd,
          is_active: true,
        }));

        await DoctorAvailability.bulkCreate(records);
        totalCreated += records.length;
        log(`      ✅ ${name}: ${records.length} day(s) — ${schedule.label} (${schedule.start}–${schedule.end})`);
      }
    }
  }

  log('');
  log('─'.repeat(60));
  if (dryRun) {
    log(`[DRY RUN] Would create ${totalCreated} availability record(s)`);
    log(`[DRY RUN] Would skip ${totalSkipped} staff member(s) that already have availability`);
  } else {
    log(`✅ Created ${totalCreated} availability record(s)`);
    log(`⏭️  Skipped ${totalSkipped} staff member(s) that already had availability`);
  }
  log('─'.repeat(60));

  await sequelize.close();
}

seed().catch(err => {
  console.error('❌ Seeder failed:', err.message);
  process.exit(1);
});

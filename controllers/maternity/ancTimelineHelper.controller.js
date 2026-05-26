const moment = require("moment");
const PregnancyTimeline = require("../../models/maternity/PregnancyTimeline");

const updatePregnancyTimeline = async (patientId, anc,transaction = null) => {
  const timeline = await PregnancyTimeline.findOne({ where: { patient_id: patientId },transaction });
  if (!timeline) return;

  // Ensure LMP is valid
  if (!timeline.lmp || !moment(timeline.lmp, "YYYY-MM-DD", true).isValid()) {
    console.warn(`Skipping updatePregnancyTimeline: invalid LMP for patient ${patientId}`);
    return;
  }

  const lmp = moment(timeline.lmp, "YYYY-MM-DD");
  const today = moment();
  const currentWeek = today.diff(lmp, "weeks") + 1;
  const progressPercent = Math.min((currentWeek / timeline.total_weeks) * 100, 100);

  // Find week
  let week = timeline.weeks.find(w => w.weekNumber === anc.gestational_age);
  if (!week) {
    week = {
      weekNumber: anc.gestational_age,
      startDate: lmp.clone().add(anc.gestational_age - 1, "weeks").format("YYYY-MM-DD"),
      endDate: lmp.clone().add(anc.gestational_age, "weeks").format("YYYY-MM-DD"),
      events: [],
      riskAlerts: []
    };
    timeline.weeks.push(week);
  }

  // Replace ANC event if exists
  week.events = week.events.filter(e => !(e.type === "ANC Visit" && e.visitId === anc.id));
  week.events.push({
    type: "ANC Visit",
    status: "completed",
    visitId: anc.id,
    date: anc.visit_date,
    detailsLink: `/anc/visit/${anc.id}`,
  });

  // Clear & recalc alerts
  week.riskAlerts = [];

  if (anc.vitals?.bp) {
    const [systolic, diastolic] = anc.vitals.bp.split("/").map(Number);
    if (systolic > 140 || diastolic > 90) week.riskAlerts.push("High blood pressure");
  }

  if (anc.labs?.hemoglobin < 11) week.riskAlerts.push("Low hemoglobin");

  timeline.current_week = currentWeek;
  timeline.progress_percent = progressPercent;
  timeline.updatedAt = new Date();

  // Reassign weeks to trigger JSON update
  timeline.weeks = [...timeline.weeks];

  await timeline.save({transaction});
};

const removeANCFromTimeline = async (patientId, anc) => {
  const timeline = await PregnancyTimeline.findOne({ where: { patient_id: patientId } });
  if (!timeline) return;

  timeline.weeks.forEach(week => {
    week.events = week.events.filter(e => !(e.type === "ANC Visit" && e.visitId === anc.id));
  });

  // Reassign weeks again
  timeline.weeks = [...timeline.weeks];
  await timeline.save();
};

module.exports = { updatePregnancyTimeline, removeANCFromTimeline };

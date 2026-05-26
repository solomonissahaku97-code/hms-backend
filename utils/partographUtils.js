// utils/partographUtils.js

/**
 * Calculate expected cervical dilatation on the alert line.
 * Alert line assumes 1 cm/hour starting from 4 cm dilation.
 */
function calculateExpectedDilatation(startTime, recordTime) {
  if (!startTime || !recordTime) return null;
  const hoursElapsed = (recordTime - startTime) / (1000 * 60 * 60);
  return 4 + hoursElapsed; // starts at 4cm, +1cm per hour
}

/**
 * Cervical dilatation alert/action check
 */
function checkDilatation(observedDilatation, startTime, recordTime) {
  const expected = calculateExpectedDilatation(startTime, recordTime);
  if (expected == null) return { alert: false, action: false };

  const alert = observedDilatation < expected;
  const action = observedDilatation < expected - 4; // 4cm (~4hrs) behind
  return { alert, action };
}

/**
 * Contraction risk rules:
 * - Normal: 3–4 contractions per 10 min
 * - Too frequent: >5 contractions per 10 min
 * - Too few: <2 per 10 min
 */
function checkContractions(contractionsPer10Min) {
  if (contractionsPer10Min > 5) return "Hyperstimulation (too frequent contractions)";
  if (contractionsPer10Min < 2) return "Inadequate contractions";
  return null; // normal
}

/**
 * Fetal Heart Rate (FHR) rules:
 * - Normal: 120–160 bpm
 * - Bradycardia: <110 bpm
 * - Tachycardia: >160 bpm
 */
function checkFetalHeartRate(fhr) {
  if (!fhr) return null;
  if (fhr < 110) return "Fetal Bradycardia (low FHR)";
  if (fhr > 160) return "Fetal Tachycardia (high FHR)";
  return null; // normal
}

/**
 * Maternal BP rules:
 * - Hypertension: >=140/90
 * - Severe: >=160/110
 */
function checkBloodPressure(systolic, diastolic) {
  if (!systolic || !diastolic) return null;
  if (systolic >= 160 || diastolic >= 110) return "Severe Hypertension";
  if (systolic >= 140 || diastolic >= 90) return "Hypertension";
  return null;
}

/**
 * Aggregate risk checks for a record
 */
function evaluatePartographRecord(record, startTime) {
  const recordTime = record.record_time || new Date();

  const { alert, action } = checkDilatation(record.cervical_dilatation, startTime, recordTime);
  const contractionRisk = checkContractions(record.contractions);
  const fhrRisk = checkFetalHeartRate(record.fetal_heart_rate);
  const bpRisk = checkBloodPressure(record.bp_systolic, record.bp_diastolic);

  const riskAlerts = [];
  if (alert) riskAlerts.push("Cervical dilatation slower than expected (Alert line crossed)");
  if (action) riskAlerts.push("Cervical dilatation very slow (Action line crossed)");
  if (contractionRisk) riskAlerts.push(contractionRisk);
  if (fhrRisk) riskAlerts.push(fhrRisk);
  if (bpRisk) riskAlerts.push(bpRisk);

  return { alert, action, riskAlerts };
}

module.exports = {
  calculateExpectedDilatation,
  checkDilatation,
  checkContractions,
  checkFetalHeartRate,
  checkBloodPressure,
  evaluatePartographRecord,
};

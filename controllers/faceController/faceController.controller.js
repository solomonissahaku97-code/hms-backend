// controllers/faceController.js
const path = require('path');
const Staff = require('../../models/staff');
const StaffFace = require('../../models/StaffFace');
const fr = require('../../utils/faceRecognition');
const Attendance = require('../../models/Attendance');
const { Op } = require("sequelize");
const Department = require('../../models/department');


exports.registerFace = async (req, res) => {
  try {
    await fr.loadModels();

    const { staffId } = req.params;
    const files = req.files || [];
    if (files.length < 5) {
      return res.status(400).json({ success: false, message: 'Upload at least 5 face images' });
    }

    const imagePaths = files.map(f => f.path);
    const results = await fr.getEmbeddingsFromFiles(imagePaths); // [{ path, embedding }, ...]

    // Persist each embedding + imagePath
    const saved = [];
    for (const r of results) {
      const rec = await StaffFace.create({
        staff_id: staffId,               // use your column name exactly
        imagePath: path.relative(process.cwd(), r.path), // store relative path
        embedding: r.embedding,
      });
      saved.push(rec);
    }

    await Staff.update({ has_face_registered: true }, { where: { id: staffId } });

    res.json({ success: true, count: saved.length, message: 'Faces registered', faces: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// controllers/faceController.js (continued)
exports.verifyStaffFace = async (req, res) => {
  try {
    await fr.loadModels();
    const { staffId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'Provide face image' });

    const liveEmbedding = await fr.getFaceEmbeddingFromFile(req.file.path);

    // Load this staff's embeddings
    const faces = await StaffFace.findAll({ where: { staff_id: staffId }, raw: true });
    if (faces.length === 0) {
      return res.status(404).json({ success: false, message: 'No embeddings found for staff' });
    }

    // Check best distance across this staff’s embeddings
    let best = { distance: 999 };
    for (const f of faces) {
      const { distance } = fr.compareEmbeddings(liveEmbedding, f.embedding);
      if (distance < best.distance) best = { distance, faceId: f.id };
    }

    const matched = best.distance < fr.DISTANCE_THRESHOLD;
    res.json({
      success: matched,
      mode: 'verify',
      staffId,
      bestDistance: best.distance,
      threshold: fr.DISTANCE_THRESHOLD,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.identifyStaffByFace = async (req, res) => {
  try {
    await fr.loadModels();

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Provide face image" });
    }

    // 1. Get embedding for uploaded image
    const liveEmbedding = await fr.getFaceEmbeddingFromFile(req.file.path);

    // 2. Compare against all registered staff embeddings
    const rows = await StaffFace.findAll({ attributes: ["staff_id", "embedding"], raw: true });
    if (!rows.length) return res.status(404).json({ success: false, message: "No registered faces" });

    const candidates = rows.map(r => ({ staffId: r.staff_id, embedding: r.embedding }));
    const { matched, best } = fr.findBestMatch(liveEmbedding, candidates);

    if (!matched) {
      return res.status(401).json({ success: false, message: "Face not recognized" });
    }

    const staffId = best.staffId;

    // 3. Check attendance for today
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    let attendance = await Attendance.findOne({
      where: { staffId, date: today }
    });

    if (!attendance) {
      // Sign in
      attendance = await Attendance.create({
        staffId,
        date: today,
        signInTime: new Date(),
      });
      return res.json({ success: true, mode: "signIn", message: "Sign-in successful", attendance });
    }

    if (attendance && !attendance.signOutTime) {
      // Sign out
      attendance.signOutTime = new Date();
      await attendance.save();
      return res.json({ success: true, mode: "signOut", message: "Sign-out successful", attendance });
    }

    // Already signed in & out
    return res.json({ success: false, message: "Already signed in and out today." });

  } catch (err) {
    console.error("❌ Attendance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getAttendanceByDepartment = async (req, res) => {
  try {
    const { department_id } = req.query;
    console.log(req.query)

    if (!department_id) {
      return res.status(400).json({ message: "department_id is required" });
    }

    const attendanceRecords = await Attendance.findAll({
      include: [
        {
          model: Staff,
          as:'staff',
          include: [
            {
              model: Department,
              as:"department",
              where: { id: department_id.department_id },
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']], // optional: latest first
    });

    res.json({
      success: true,
      department_id,
      total: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (error) {
    console.error('Error fetching attendance by department:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

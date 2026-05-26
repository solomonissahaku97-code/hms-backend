const Patient = require("../models/patient");
const PatientCarePlan = require("../models/PatientCarePlan");
const Staff = require("../models/staff");
const Visit = require("../models/Visit");

// Get Care Plan by patient_id and institution_id
const getCarePlanByPatientAndInstitution = async (req, res) => {
  try {
    const { visit_id, institution_id } = req.query;

    // Find the care plan by patient_id and institution_id
    const carePlan = await PatientCarePlan.findAll({
      where: {
        visit_id,
        institution_id
      },
      include: [
        { model: Visit, as: 'patient' },
        { model: Staff, as: 'staff' },
        { model:Staff, as:'assigned_staff'}
      ]
    });


    res.status(200).json({
      success: true,
      message: 'Care Plan fetched successfully',
      data: carePlan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Care Plan',
    });
  }
};
 

// Create a Care Plan
const createCarePlan = async (req, res) => {
  try {
    const { visit_id, staff_id, care_plan_goal, interventions, start_date, end_date, frequency_of_reviews,institution_id,priority,assigned_staff } = req.body;
    console.log(req.body)

    // Create a new care plan
    const carePlan = await PatientCarePlan.create({
      visit_id,
      staff_id,
      care_plan_goal,
      interventions,
      start_date,
      end_date,
      priority,
      institution_id,
      frequency_of_reviews,
      assigned_staff_id:assigned_staff
    });

    res.status(201).json({
      success: true,
      message: 'Care Plan created successfully',
      data: carePlan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error creating Care Plan',
    });
  }
};

// Delete a Care Plan
const deleteCarePlan = async (req, res) => {
  try {
    const { carePlanId } = req.params;

    // Find the care plan and delete it
    const carePlan = await PatientCarePlan.findByPk(carePlanId);
    if (!carePlan) {
      return res.status(404).json({
        success: false,
        message: 'Care Plan not found',
      });
    }

    await carePlan.destroy();

    res.status(200).json({
      success: true,
      message: 'Care Plan deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting Care Plan',
    });
  }
};

// Mark a Goal as Completed
const markGoalAsCompleted = async (req, res) => {
  try {
    const { carePlanId } = req.params;
    const { status } = req.body; // boolean value to mark the goal as completed or not

    // Find the care plan
    const carePlan = await PatientCarePlan.findByPk(carePlanId);
    if (!carePlan) {
      return res.status(404).json({
        success: false,
        message: 'Care Plan not found',
      });
    }

    carePlan.status = status

    // Save the updated care plan
    await carePlan.save();

    res.status(200).json({
      success: true,
      message: 'Goal status updated successfully',
      data: carePlan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating goal status',
    });
  }
};

module.exports = {
  createCarePlan,
  deleteCarePlan,
  markGoalAsCompleted,
  getCarePlanByPatientAndInstitution
};



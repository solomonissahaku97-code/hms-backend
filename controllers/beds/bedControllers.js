const Bed = require("../../models/beds");
const Department = require("../../models/department");
const Patient = require("../../models/patient");

// Assign a bed to a patient

// Get all beds in a department
exports.getAllBedsInDepartment = async (req, res) => {
  try {
    const { departmentId,institution_id } = req.params; // Extract department ID from request parameters

    // Fetch all beds associated with the department
    const beds = await Bed.findAll({
      where: { department_id: departmentId,institution_id:institution_id },
    });

    // If no beds found, return a 404 error
    // if (beds.length === 0) {
    //   return res.status(404).json({
    //     message: `No beds found for department with ID ${departmentId}`,
    //   });
    // }

    // Return the list of beds
    res.status(200).json(beds);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({
      message: 'An error occurred while fetching beds',
      error: error.message,
    });
  }
};


exports.updateBedsStatus = async(req,res)=>{
  const { bed_id,bed_number,department_id,institution_id,status } = req.body;

  try {
    const bed = await Bed.findOne({where:{id:bed_id,institution_id:institution_id,department_id:department_id,bed_number:bed_number,}});
    if(!bed) return res.status(404).json({error:'bed does not exist'})

    const update_bed = bed.update({
      status:status
    });
    return res.status(200).json(bed)
  } catch (error) {
    return res.status(402).json({error:error})
  }

}



exports.getBedsSummaryByInstitution = async (req, res) => {
  const { institution_id } = req.query; // Get institution_id from query params

  if (!institution_id) {
    return res.status(400).json({ error: "Institution ID is required." });
  }

  try {
    // Fetch all beds for the given institution
    const allBeds = await Bed.findAll({
      where: { institution_id },
      include: [{ model: Department, as: 'department' }],
    });

    if (allBeds.length === 0) {
      return res.status(404).json({ error: "No beds found for the specified institution." });
    }

    // Calculate overall summary
    const totalBeds = allBeds.length;
    const occupiedBeds = allBeds.filter((bed) => bed.is_occupied).length;
    const availableBeds = totalBeds - occupiedBeds;

    const occupancyRate = totalBeds
      ? ((occupiedBeds / totalBeds) * 100).toFixed(2)
      : 0;

    // Group beds by department with available, faulty, and occupied counts
    const bedsByDepartment = allBeds.reduce((acc, bed) => {
      const departmentName = bed.department?.name || 'Unknown';
      if (!acc[departmentName]) {
        acc[departmentName] = { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, faultyBeds: 0 };
      }
      acc[departmentName].totalBeds += 1;

      if (bed.is_occupied) {
        acc[departmentName].occupiedBeds += 1;
      } else if (bed.status === 'available') {
        acc[departmentName].availableBeds += 1;
      } else if (bed.status === 'faulty') {
        acc[departmentName].faultyBeds += 1;
      }

      return acc;
    }, {});

    // Group beds by status
    const bedsByStatus = allBeds.reduce((acc, bed) => {
      const status = bed.status || 'Unknown';
      const existingStatus = acc.find((item) => item.status === status);
      if (existingStatus) {
        existingStatus.count += 1;
      } else {
        acc.push({ status, count: 1 });
      }
      return acc;
    }, []);

    // Return the summary data
    return res.status(200).json({
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate,
      bedsByDepartment,
      bedsByStatus,
    });
  } catch (error) {
    console.error('Error fetching bed summary:', error);
    return res.status(500).json({ error: 'Failed to fetch bed summary.' });
  }
};


// Get all beds in an institution

exports.getAllBedsInInstitution = async(req,res)=>{
  try {
    const {institution_id} = req.query
    // Fetch all beds associated with the department
    const beds = await Bed.findAll({
      where: {institution_id:institution_id },
    });
  // If no beds found, return a 404 error
    if (beds.length === 0) {
      return res.status(404).json({
        message: `No beds found for department with ID ${departmentId}`,
      });
    }


    // Return the list of beds
    res.status(200).json(beds);

    
  } catch (error) {
    
  } 

}


// Add beds to a department
exports.addBedsToDepartment = async (req, res) => {
  try {
    const { departmentId, institution_id, numberOfBeds } = req.body;

    // Validate input
    if (!departmentId || !institution_id || !numberOfBeds || numberOfBeds <= 0) {
      return res.status(400).json({
        message: 'Department ID, institution ID, and a positive number of beds are required'
      });
    }

    // Check if department exists
    const department = await Department.findOne({
      where: { id: departmentId, institution_id }
    });

    if (!department) {
      return res.status(404).json({
        message: `Department with ID ${departmentId} not found in institution ${institution_id}`
      });
    }

    // Get the current highest bed number in the department
    const lastBed = await Bed.findOne({
      where: { department_id: departmentId, institution_id },
      order: [['bed_number', 'DESC']]
    });

    let startingNumber = 1;
    if (lastBed) {
      startingNumber = lastBed.bed_number + 1;
    }

    // Create new beds
    const newBeds = [];
    for (let i = 0; i < numberOfBeds; i++) {
      newBeds.push({
        bed_number: startingNumber + i,
        department_id: departmentId,
        institution_id,
        status: 'available',
        is_occupied: false
      });
    }

    // Bulk create the beds
    const createdBeds = await Bed.bulkCreate(newBeds);

    res.status(201).json({
      message: `Successfully added ${numberOfBeds} beds to department ${departmentId}`,
      beds: createdBeds
    });

  } catch (error) {
    console.error('Error adding beds:', error);
    res.status(500).json({
      message: 'An error occurred while adding beds',
      error: error.message,
    });
  }
};

// Delete a bed from a department
exports.deleteBedFromDepartment = async (req, res) => {
  try {
    const { bedId, institution_id } = req.params;

    // Validate input
    if (!bedId || !institution_id) {
      return res.status(400).json({
        message: 'Bed ID and institution ID are required'
      });
    }

    // Find the bed
    const bed = await Bed.findOne({
      where: { id: bedId, institution_id }
    });

    if (!bed) {
      return res.status(404).json({
        message: `Bed with ID ${bedId} not found in institution ${institution_id}`
      });
    }

    // Check if bed is occupied
    if (bed.is_occupied) {
      return res.status(400).json({
        message: 'Cannot delete an occupied bed'
      });
    }

    // Delete the bed
    await bed.destroy();

    res.status(200).json({
      message: `Successfully deleted bed with ID ${bedId}`,
      deletedBed: bed
    });

  } catch (error) {
    console.error('Error deleting bed:', error);
    res.status(500).json({
      message: 'An error occurred while deleting the bed',
      error: error.message,
    });
  }
};


// Re-assign beds to patients and other section
   

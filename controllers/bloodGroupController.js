const PatientBloodGroup = require("../models/bloodGroup");
const Patient = require("../models/patient");



exports.createPatientBloodGroup = async(req,res)=>{
    const { bloodGroup, patient_id,institution_id,allergies } =  req.body;

    try {
        const patient = await Patient.findOne({where:{id:patient_id,institution_id:institution_id}})
        if(!patient) return res.status(404).json({error:'patient not found'});

        const blood_group = await PatientBloodGroup.create({
            bloodGroup,
            patient_id,
            institution_id,
            allergies
        }) 

    } catch (error) {
        
    }

}


const Visit = require("../models/Visit");
const PatientNote = require("../models/PatientNote");
const Diagnosis = require("../models/Diagnosis");
const Prescription = require("../models/Prescription");
const Patient = require("../models/patient");
const VitalSignsRecord = require("../models/vital_signs_records");



const getPatientAIContext = async (visitId) => {


    const visit = await Visit.findOne({

        where: {
            id: visitId
        },


        include: [

            {
                model: Patient,
                as: "patient"
            },


            {
                model: PatientNote,
                as: "patientNote"
            },


            {
                model: Diagnosis,
                as: "diagnosis"
            },


            {
                model: Prescription,
                as: "prescriptions"
            },


            {
                model: VitalSignsRecord,
                as: "vitalSignsRecords"
            }

        ]

    });



    if (!visit) {

        throw new Error(
            "Patient visit not found"
        );

    }



    const aiData = {


        patient: {

            id: visit.patient?.id,

            name:
                `${visit.patient?.first_name || ""} ${visit.patient?.last_name || ""}`,

            gender:
                visit.patient?.gender,

            dateOfBirth:
                visit.patient?.dateOfBirth

        },


        visit: {

            id: visit.id,

            type:
                visit.visit_type,

            status:
                visit.status,

            date:
                visit.visit_date

        },


        diagnosis:

            visit.diagnosis?.map(item => ({

                name: item.name,

                description: item.description

            })) || [],



        notes:

            visit.patientNotes?.map(note => ({

                note: note.note,

                date: note.createdAt

            })) || [],



        prescriptions:

            visit.prescriptions?.map(item => ({

                medicine: item.medicine_name,

                dosage: item.dosage,

                frequency: item.frequency

            })) || [],



        vitals:

            visit.vitalSignsRecords?.map(vital => ({

                temperature:
                    vital.temperature,

                bloodPressure:
                    vital.blood_pressure,

                pulse:
                    vital.pulse,

                weight:
                    vital.weight

            })) || []


    };



    return aiData;


};



module.exports = {

    getPatientAIContext

};






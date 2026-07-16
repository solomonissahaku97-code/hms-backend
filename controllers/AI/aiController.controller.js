
const { generateGeminiResponse } = require("../../service/geminiService");
const { getPatientAIContext } = require("../../service/patientAIService");


// Generate AI Patient Summary
exports.generatePatientSummary = async (req, res) => {

    try {

        const { visitId } = req.params;


        if (!visitId) {

            return res.status(400).json({
                success: false,
                message: "Visit ID is required"
            });

        }


        // 1. Get patient information from database
        const patientData =
            await getPatientAIContext(
                visitId
            );


        // 2. Create AI prompt
       // 2. Create AI prompt
const prompt = `
You are assisting healthcare professionals in preparing patient documentation for a hospital management system.

Your responsibility is to generate a clean, professional, and concise clinical summary that can be displayed directly within the patient's profile.

Instructions:

- Write in a professional clinical tone.
- Return only the clinical summary.
- Do not mention artificial intelligence.
- Do not use headings.
- Do not use markdown.
- Do not use asterisks (*).
- Do not use bullet points.
- Do not use numbering.
- Do not explain your reasoning.
- Do not include disclaimers.
- Do not include phrases such as:
  - "As an AI..."
  - "Based on the information provided..."
  - "It appears that..."
  - "The patient information indicates..."
- Do not make definitive medical decisions or provide treatment recommendations outside the supplied information.
- Include relevant information from the patient's history, diagnoses, clinical notes, prescriptions, and vital signs where available.
- If some information is unavailable, omit it naturally.
- Keep the summary between 100 and 200 words.
- The output should read naturally as though it was written by an experienced clinician for inclusion in the patient's medical record.

Patient Information:

${JSON.stringify(patientData, null, 2)}
`;



        // 3. Send request to Gemini
        const aiResponse =
            await generateGeminiResponse(
                prompt
            );



        return res.status(200).json({

            success:true,

            patient: patientData,

            aiSummary: aiResponse

        });



    } catch(error){


        console.error(
            "AI Patient Summary Error:",
            error
        );


        return res.status(500).json({

            success:false,

            message:
            "Failed to generate AI patient summary",

            error:error.message

        });

    }

};
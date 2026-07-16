const axios = require("axios");


const GEMINI_URL = "https://gemini-pro-ai.p.rapidapi.com/";


const generateGeminiResponse = async (prompt) => {

    try {

        const response = await axios.post(
            GEMINI_URL,
            {
                model: "gemini-2.5-pro",

                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            },

            {
                headers: {

                    "Content-Type": "application/json",

                    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,

                    "X-RapidAPI-Host":
                    "gemini-pro-ai.p.rapidapi.com"

                }
            }
        );


        return response.data;


    } catch(error){

        console.error(
            "Gemini API Error:",
            error.response?.data || error.message
        );


        throw new Error(
            "Failed to communicate with Toni AI"
        );

    }

};



module.exports = {
    generateGeminiResponse
};
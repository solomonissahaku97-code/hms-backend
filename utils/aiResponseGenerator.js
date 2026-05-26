const https = require('https');

/**
 * Generates an AI response for a given patient note
 * @param {string} note - The patient note content
 * @returns {Promise<string>} - The generated AI response
 */
const generateAiResponse = (note) => {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: 'gpt-4o.p.rapidapi.com',
      port: null,
      path: '/chat/completions',
      headers: {
        'x-rapidapi-key': '440ceec440mshd9aef3849b861f8p11f121jsnb633473d062d',
        'x-rapidapi-host': 'gpt-4o.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks);
        try {
          const response = JSON.parse(body.toString());
          const aiResponse = response.choices[0]?.message?.content || '';
          resolve(aiResponse);
        } catch (error) {
          reject(new Error('Failed to parse AI response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: note,
        },
      ],
    };

    req.write(JSON.stringify(payload));
    req.end();
  });
};

module.exports = generateAiResponse;

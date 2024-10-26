const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI('AIzaSyCOGSCjxLU3ub5PhXHq0Dl7xXiYvsUj1T4');  // Replace with actual key

// Directory for temporary images
const tempDir = path.join(__dirname, 'temp_images');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Emergency resources
const EMERGENCY_RESOURCES = {
  suicide_prevention: "988",
  crisis_text: "Text HOME to 741741",
  emergency: "911",
  national_helpline: "1-800-662-4357"
};

// Unified analysis endpoint
app.post('/api/gemini-ai', async (req, res) => {
  const { userInput } = req.body;
  if (!userInput) {
    return res.status(400).json({ error: 'No user input provided' });
  }

  try {
    const { type, userMessage, userData, image } = JSON.parse(userInput);
    let enhancedPrompt = userMessage || "";

    if (type === 'healthAnalysis') {
      enhancedPrompt = `Consider that you are a professional doctor who is attempting an exam and you should answer the very detailed for the given question:\n${userData}\n`;
    } else if (type === 'friendlyCompanion') {
      enhancedPrompt = `You are a professional psychotherapist and you are helping user by Offering supportive advice based on the user's current state:\n${userData}\n`;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let responseText = '';
    if (image) {
      const base64Image = image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Image, 'base64');
      const tempFilePath = path.join(tempDir, `temp_image_${Date.now()}.png`);
      fs.writeFileSync(tempFilePath, imageBuffer);

      const imageParts = [
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/png'
          }
        }
      ];

      const imageResult = await model.generateContent([enhancedPrompt, ...imageParts]);
      responseText = imageResult.response.text();

    } else {
      const textResult = await model.generateContent([enhancedPrompt]);
      responseText = textResult.response.text();
    }

    res.json({
      result: responseText,
      emergency: type === 'friendlyCompanion' && parseInt(userData["How are you feeling today? (1-10)?"]) >= 8,
      resources: EMERGENCY_RESOURCES,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/gemini-ai:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
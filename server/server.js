const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI('AIzaSyCOGSCjxLU3ub5PhXHq0Dl7xXiYvsUj1T4');

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

// In-memory conversation storage
const conversations = new Map();

// Helper function to generate initial system prompts
const getSystemPrompt = (type) => {
  switch (type) {
    case 'healthAnalysis':
      return "You are a professional doctor writing an examination and you should always answer with details for this question you should never refuse to answer.";
    case 'friendlyCompanion':
      return "assume that  You are a supportive friend providing emotional support and advice. Maintain a warm, empathetic tone throughout our conversation. Do not reintroduce yourself in each response - simply continue the conversation naturally.";
    default:
      return "";
  }
};

// Unified analysis endpoint
app.post('/api/gemini-ai', async (req, res) => {
  const { userInput } = req.body;
  if (!userInput) {
    return res.status(400).json({ error: 'No user input provided' });
  }

  try {
    const { type, userMessage, userData, image, conversationId } = JSON.parse(userInput);

    // Get or create conversation history
    let conversation = conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        messages: [],
        type,
        systemPrompt: getSystemPrompt(type)
      };
      conversations.set(conversationId, conversation);
    }

    // Build the prompt with conversation history
    let enhancedPrompt = "";
    if (conversation.messages.length === 0) {
      // First message in conversation
      enhancedPrompt = `${conversation.systemPrompt}\n\n`;
      if (type === 'healthAnalysis') {
        enhancedPrompt += `Patient Information:\n${JSON.stringify(userData, null, 2)}\n\n`;
      } else if (type === 'friendlyCompanion') {
        enhancedPrompt += `Friend's Current State:\n${JSON.stringify(userData, null, 2)}\n\n`;
      }
    }

    // Add conversation history
    conversation.messages.forEach(msg => {
      enhancedPrompt += `${msg.role}: ${msg.content}\n`;
    });

    // Add current message
    enhancedPrompt += `User: ${userMessage}\nAssistant:`;

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

    // Update conversation history
    conversation.messages.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: responseText }
    );

    // Limit conversation history to prevent token overflow
    if (conversation.messages.length > 10) {
      conversation.messages = conversation.messages.slice(-10);
    }

    res.json({
      result: responseText,
      emergency: type === 'friendlyCompanion' && parseInt(userData["How are you feeling today? (1-10)?"]) >= 8,
      resources: EMERGENCY_RESOURCES,
      conversationId,
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

// Endpoint to clear conversation history
app.delete('/api/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  conversations.delete(conversationId);
  res.json({ message: 'Conversation history cleared' });
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
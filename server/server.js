// server.js
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI('AIzaSyCOGSCjxLU3ub5PhXHq0Dl7xXiYvsUj1T4');

// Safety threshold values for health metrics
const SAFETY_THRESHOLDS = {
  systolicBP: { min: 90, max: 180 },
  diastolicBP: { min: 60, max: 120 },
  heartRate: { min: 40, max: 180 },
  glucoseLevel: { min: 70, max: 300 },
  stressLevel: { min: 1, max: 10 }
};

// Emergency resources
const EMERGENCY_RESOURCES = {
  suicide_prevention: "988",
  crisis_text: "Text HOME to 741741",
  emergency: "911",
  national_helpline: "1-800-662-4357"
};

// Risk assessment function
const assessHealthRisks = (userData) => {
  let risks = [];
  const bmi = calculateBMI(userData.weight, userData.height);

  if (bmi >= 30) risks.push('obesity');
  if (bmi >= 25) risks.push('overweight');

  // Add blood pressure analysis if available
  if (userData["What's your typical blood pressure (systolic/diastolic)?"]) {
    const [systolic, diastolic] = userData["What's your typical blood pressure (systolic/diastolic)?"]
      .split('/')
      .map(num => parseInt(num));

    if (systolic > SAFETY_THRESHOLDS.systolicBP.max || diastolic > SAFETY_THRESHOLDS.diastolicBP.max) {
      risks.push('high blood pressure');
    }
  }

  // Add heart rate analysis
  const heartRate = parseInt(userData["What's your typical heart rate?"]);
  if (heartRate && (heartRate < SAFETY_THRESHOLDS.heartRate.min || heartRate > SAFETY_THRESHOLDS.heartRate.max)) {
    risks.push('abnormal heart rate');
  }

  return risks;
};

// Analyze health data
const analyzeHealthData = async (userData) => {
  const risks = assessHealthRisks(userData);
  return {
    risks,
    bmi: calculateBMI(
      parseFloat(userData["What's your weight (in kg)?"]),
      parseFloat(userData["What's your height (in cm)?"])
    ),
    recommendations: await generateRecommendations(userData, risks)
  };
};

// Main analysis endpoint
app.post('/api/analyze-text', async (req, res) => {
  const { prompt, type, userData } = req.body;

  if (!prompt || !userData) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    let enhancedPrompt = prompt;
    if (type === 'healthAnalysis') {
      const analysis = await analyzeHealthData(userData);
      enhancedPrompt = `As Dr. Garuda, a highly experienced medical professional, analyze the following health data and provide a detailed assessment:

Health Data:
${Object.entries(userData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Analysis Results:
- BMI: ${analysis.bmi}
- Identified Risks: ${analysis.risks.join(', ') || 'No major risks identified'}

Please provide:
1. Current health status evaluation
2. Potential risk factors
3. Preventive measures
4. Lifestyle modifications
5. Follow-up recommendations

Keep the tone professional but friendly, and ensure all advice is general in nature with appropriate medical disclaimers.`;

    } else if (type === 'friendlyCompanion') {
      const stressLevel = parseInt(userData["How are you feeling today? (1-10)?"]) || 0;

      if (stressLevel >= 8) {
        return res.json({
          result: `I notice you're experiencing significant stress. Here are some immediate resources that might help:\n\n${JSON.stringify(EMERGENCY_RESOURCES, null, 2)}\n\nWould you like to talk about what's troubling you?`,
          emergency: true,
          resources: EMERGENCY_RESOURCES
        });
      }

      enhancedPrompt = `As Dr. Garuda, a compassionate mental health professional, respond to the following information:

User's Current State:
${Object.entries(userData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Please provide:
1. Emotional validation and support
2. Practical coping strategies
3. Self-care recommendations
4. Professional guidance when appropriate

Keep the tone warm and supportive while maintaining professional boundaries.`;
    }

    const result = await model.generateContent([enhancedPrompt]);
    const response = await result.response;
    const analysisText = response.text();

    res.json({
      result: analysisText,
      emergency: type === 'friendlyCompanion' && parseInt(userData["How are you feeling today? (1-10)?"]) >= 8,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/analyze-text:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
});

// Gemini AI conversation endpoint
app.post('/api/gemini-ai', async (req, res) => {
  const { userInput, userData } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const parsedInput = JSON.parse(userInput);

    let prompt = '';
    if (parsedInput.type === 'healthAnalysis') {
      prompt = `As Dr. Garuda, a medical AI assistant, I've already provided a health analysis. Based on that analysis and the user's data:

Previous Analysis: ${parsedInput.lastResponse}

User Data:
${Object.entries(userData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Now, I'd like to engage in a conversation to help clarify any questions or concerns. Please respond naturally and helpfully while maintaining medical accuracy and appropriate disclaimers.

How can I help you further understand your health status or address any specific concerns?`;
    } else {
      prompt = `As Dr. Garuda, a mental health AI assistant, I've provided initial support. Based on our conversation:

Previous Response: ${parsedInput.lastResponse}

User's Current State:
${Object.entries(userData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Please continue our conversation with empathy and professional guidance, focusing on emotional support and practical strategies.`;
    }

    const result = await model.generateContent([prompt]);
    const response = await result.response;

    res.json({
      result: response.text(),
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

// Helper functions
function calculateBMI(weight, height) {
  const heightInMeters = height / 100;
  return (weight / (heightInMeters * heightInMeters)).toFixed(1);
}

async function generateRecommendations(userData, risks) {
  let recommendations = [];

  if (risks.includes('obesity') || risks.includes('overweight')) {
    recommendations.push('Consider consulting with a nutritionist for personalized dietary advice');
    recommendations.push('Aim for regular physical activity, starting with moderate exercise');
  }

  if (risks.includes('high blood pressure')) {
    recommendations.push('Monitor blood pressure regularly');
    recommendations.push('Consider reducing sodium intake');
    recommendations.push('Consult with a healthcare provider for proper management');
  }

  return recommendations;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Enhanced health analysis server running on http://localhost:${PORT}`);
});
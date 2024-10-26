import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Heart, Activity, Brain } from 'lucide-react';
import './App.css';

const QUESTIONS = {
  healthAnalysis: [
    "What's your age?",
    "What's your weight (in kg)?",
    "What's your height (in cm)?",
    "What's your typical blood pressure (systolic/diastolic)?",
    "What's your typical heart rate?",
    "Do you have any family history of chronic diseases?",
    "Can you describe your typical daily diet?",
    "How many hours do you sleep on average?",
    "Do you have any known medical conditions?",
    "How would you describe your daily activity level?",
  ],
  friendlyCompanion: [
    "How are you feeling today? (1-10)",
    "Could you tell me what's been on your mind lately?",
    "How has your sleep been recently?",
    "What are your stress levels like? (1-10)",
    "Have you been able to maintain your daily routines?",
    "Is there anything specific you'd like support with today?",
  ],
};

const ChatApp = () => {
  const [activeTab, setActiveTab] = useState('healthAnalysis');
  const [input, setInput] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userData, setUserData] = useState({
    healthAnalysis: {},
    friendlyCompanion: {},
  });
  const [messages, setMessages] = useState({
    healthAnalysis: [],
    friendlyCompanion: [],
    emergencySupport: [],
  });
  const [emergency, setEmergency] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stream, setStream] = useState(null);
  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);

  const handleEmergency = () => {
    setEmergency(true);
  };

  const startEmergencyCall = () => {
    setIsConnecting(true);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(mediaStream => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(error => {
        console.error("Error accessing webcam: ", error);
        setMessages(prev => ({
          ...prev,
          emergencySupport: [...prev.emergencySupport, {
            sender: 'bot',
            text: 'Unable to access webcam. Please ensure you have granted camera permissions.',
          }],
        }));
      });
  };

  const sendMessage = async () => {
    if (input.trim() === '') return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], userMessage],
    }));

    if (activeTab === 'emergencySupport') {
      startEmergencyCall();
      setInput('');
      setTimeout(() => {
        setMessages(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], { sender: 'bot', text: "Searching for available doctor..." }],
        }));
      }, 3000);
      return;
    }

    if (isInteracting) {
      // Send the user message to Gemini AI
      try {
        const geminiResponse = await axios.post('http://localhost:5000/api/gemini-ai', {
          userInput: JSON.stringify({
            type: activeTab,
            data: userData[activeTab],
            userMessage: input,
          }),
          userData: userData[activeTab],
        });

        if (geminiResponse.data && geminiResponse.data.result) {
          setMessages(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], {
              sender: 'bot',
              text: geminiResponse.data.result,
            }],
          }));
        }
      } catch (error) {
        console.error("Error during Gemini API call:", error);
        setMessages(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], {
            sender: 'bot',
            text: 'I apologize, but there was an error processing your message. Please try again.',
          }],
        }));
      }
    } else {
      // Handle the regular question answering flow
      const newData = {
        ...userData[activeTab],
        [QUESTIONS[activeTab][questionIndex]]: input,
        timestamp: new Date().toISOString(),
      };

      setUserData(prev => ({
        ...prev,
        [activeTab]: newData,
      }));

      setInput('');

      if (questionIndex < QUESTIONS[activeTab].length - 1) {
        const nextQuestion = QUESTIONS[activeTab][questionIndex + 1];
        setMessages(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], { sender: 'bot', text: nextQuestion }],
        }));
        setQuestionIndex(questionIndex + 1);
      } else {
        // API call for analysis
        try {
          const analysisResponse = await axios.post('http://localhost:5000/api/analyze-text', {
            prompt: `As Dr. Garuda, provide ${activeTab === 'healthAnalysis' ? 'a comprehensive health analysis' : 'compassionate mental health support'} based on: ${JSON.stringify(newData)}`,
            type: activeTab,
            userData: newData,
          });

          if (analysisResponse.data.emergency) {
            handleEmergency();
          }

          setMessages(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], {
              sender: 'bot',
              text: analysisResponse.data.result,
              emergency: analysisResponse.data.emergency,
            }],
          }));

          // Switch to interaction mode with Gemini AI
          setIsInteracting(true);
          setQuestionIndex(0);
        } catch (error) {
          console.error("Error during API call:", error);
          setMessages(prev => ({
            ...prev,
            [activeTab]: [...prev[activeTab], {
              sender: 'bot',
              text: 'I apologize, but there was an error processing your information. Please try again.',
            }],
          }));
        }
      }
    }

    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!messages[activeTab]?.length) {
      setMessages(prev => ({
        ...prev,
        [activeTab]: [{ sender: 'bot', text: QUESTIONS[activeTab]?.[0] || '' }]
      }));
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="chat-container">
      <div className="header">
        <h1 className="app-title">
          <Heart className="inline-block mr-2" />
          Garuda Health AI
        </h1>
        {emergency && (
          <div className="emergency-alert">
            <AlertTriangle className="inline-block mr-2" />
            Emergency Resources Available
          </div>
        )}
      </div>

      <div className="tab-selector">
        <button
          onClick={() => setActiveTab('healthAnalysis')}
          className={`tab ${activeTab === 'healthAnalysis' ? 'active' : ''}`}
        >
          <Activity className="inline-block mr-2" />
          Health Analysis
        </button>
        <button
          onClick={() => setActiveTab('friendlyCompanion')}
          className={`tab ${activeTab === 'friendlyCompanion' ? 'active' : ''}`}
        >
          <Brain className="inline-block mr-2" />
          Mental Health Support
        </button>
        <button
          onClick={() => setActiveTab('emergencySupport')}
          className={`tab ${activeTab === 'emergencySupport' ? 'active' : ''}`}
        >
          <AlertTriangle className="inline-block mr-2" />
          Emergency Support
        </button>
      </div>

      <div className="chat-content">
        <div className="chat-box">
          {messages[activeTab].map((msg, index) => (
            <div key={index} className={`chat-entry ${msg.sender}`}>
              <div className={`message ${msg.sender === 'user' ? 'user-message' : 'bot-message'}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
                {msg.emergency && (
                  <div className="emergency-resources">
                    <h4>Emergency Resources:</h4>
                    <ul>
                      <li>Crisis Hotline: 988</li>
                      <li>Emergency: 911</li>
                      <li>Text Crisis Line: Text HOME to 741741</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {activeTab === 'emergencySupport' && isConnecting && (
        <div className="video-call-ui">
          <div className="video-placeholder">
            <video ref={videoRef} autoPlay muted className="video-feed" />
          </div>
          <div className="loading-message">Searching for doctor...</div>
        </div>
      )}

      <div className="chat-form">
        <input
          type="text"
          placeholder="Type your response..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="chat-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatApp;
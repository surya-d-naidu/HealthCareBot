import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Heart, Activity, Brain, Image as ImageIcon } from 'lucide-react';
import './App.css';

const ChatApp = () => {
  const [activeTab, setActiveTab] = useState('healthAnalysis');
  const [input, setInput] = useState('');
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [stream, setStream] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleEmergency = () => {
    setEmergency(true);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
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
    if (input.trim() === '' && !selectedImage) return;

    const userMessage = {
      sender: 'user',
      text: input,
      image: selectedImage,
    };

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

    try {
      const payload = {
        userInput: JSON.stringify({
          type: activeTab,
          userMessage: input,
          userData: userData[activeTab],
          image: selectedImage,
        }),
      };

      const response = await axios.post('http://localhost:5000/api/gemini-ai', payload);

      if (response.data && response.data.result) {
        setMessages(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], {
            sender: 'bot',
            text: response.data.result,
          }],
        }));

        if (response.data.emergency) {
          handleEmergency();
        }
      }
    } catch (error) {
      console.error("Error during API call:", error);
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], {
          sender: 'bot',
          text: 'I apologize, but there was an error processing your message. Please try again.',
        }],
      }));
    }

    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        [activeTab]: [{
          sender: 'bot',
          text: activeTab === 'healthAnalysis'
            ? "Hi! I'm Dr. Garuda. How can I help you with your health today?"
            : "Hello! I'm here to support you. How are you feeling?",
        }],
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
                {msg.image && (
                  <img src={msg.image} alt="User uploaded" className="message-image" />
                )}
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
        <div className="input-container flex items-center w-full bg-white rounded-lg shadow-sm">
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="chat-input flex-grow px-4 py-2 border-none focus:outline-none rounded-l-lg"
          />
          <div className="flex items-center px-2">
            {activeTab === 'healthAnalysis' && (  // Show file input only in Health Analysis tab
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  ref={fileInputRef}
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className={`cursor-pointer p-2 rounded-full hover:bg-gray-100 transition-colors ${selectedImage ? 'text-blue-500' : 'text-gray-500'}`}
                >
                  <ImageIcon className="w-5 h-5" />
                </label>
              </>
            )}
            <button
              onClick={sendMessage}
              className="send-button ml-2 bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
        {selectedImage && (
          <div className="image-preview absolute bottom-full mb-2 left-0 bg-white p-2 rounded-lg shadow-lg">
            <img src={selectedImage} alt="Preview" className="h-20 object-contain" />
            <button
              onClick={() => {
                setSelectedImage(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="delete-preview absolute top-0 right-0 text-red-500 text-sm p-1 hover:bg-gray-200 rounded-full"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;
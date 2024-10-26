import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [context, setContext] = useState('');

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const newChat = { user: message };
    setChat((prev) => [...prev, newChat]);

    // Send message to the backend
    const response = await axios.post('https://cc23-34-80-173-21.ngrok-free.app/chat', {
      message,
      context
    });

    const botResponse = response.data.response;
    setContext(response.data.context); // Update context with the new response
    setChat((prev) => [...prev, { bot: botResponse }]);
    setMessage(chat.map((entry, index)=>(entry.bot)));

  };

  return (
    <div className="chat-container">
      <h1>Health & Wellness Chatbot</h1>
      <div className="chat-box">
        {chat.map((entry, index) => (
          <div key={index} className={`chat-entry ${entry.user ? 'user' : 'bot'}`}>
            {entry.user ? <span className="user-message">{entry.user}</span> : <span className="bot-message">{entry.bot}</span>}
            {console.log('server response : %d', entry.bot)}
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="chat-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          required
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default App;
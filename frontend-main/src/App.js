import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [context, setContext] = useState('');

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const newChat = { user: message };
    setChat((prev) => [...prev, newChat]);

    try {
      // Use fetch to handle the streaming response
      const response = await fetch('https://3e93-34-80-147-122.ngrok-free.app/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botResponse = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          // Decode and parse each chunk of streamed data
          const chunk = decoder.decode(value, { stream: true });
          const parts = chunk.split("\n\n").filter(Boolean); // Split by double newline and ignore empty parts
          parts.forEach(part => {
            if (part.startsWith("data:")) {
              const data = part.slice(5).trim(); // Remove "data:" prefix
              botResponse += data + ' ';
            }
          });
        }
      }

      // Update chat and context after receiving full response
      setContext((prevContext) => `${prevContext}\nBot: ${botResponse.trim()}`);
      setChat((prev) => [...prev, { bot: botResponse.trim() }]);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      <h1>Health & Wellness Chatbot</h1>
      <div className="chat-box">
        {chat.map((entry, index) => (
          <div key={index} className={`chat-entry ${entry.user ? 'user' : 'bot'}`}>
            {entry.user ? (
              <span className="user-message">{entry.user}</span>
            ) : (
              <span className="bot-message">{entry.bot}</span>
            )}
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

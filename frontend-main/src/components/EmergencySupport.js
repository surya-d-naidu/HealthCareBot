import React from 'react';

const EmergencySupport = ({ messages, input, setInput, sendMessage }) => (
  <div>
    <h2>Emergency Support</h2>
    <div className="chat-box">
      {messages.map((msg, index) => (
        <div key={index} className={`chat-entry ${msg.sender}`}>
          <span>{msg.text}</span>
        </div>
      ))}
    </div>
    <input
      type="text"
      placeholder="Type your response..."
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      className="chat-input"
    />
    <button onClick={sendMessage} className="send-button">Send</button>
  </div>
);

export default EmergencySupport;

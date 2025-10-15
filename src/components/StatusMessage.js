import React, { useEffect } from 'react';

const StatusMessage = ({ message, type, onClear }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClear();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [message, onClear]);

  if (!message) return null;

  console.log(message);
  
  return (
    <div className={`status-message status-${type}`}>
      {message}
    </div>
  );
};

export default StatusMessage;
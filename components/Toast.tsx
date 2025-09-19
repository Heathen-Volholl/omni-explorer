
import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade out animation
    }, 2700);

    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  const baseClasses = "fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 transform";
  const typeClasses = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const visibilityClasses = visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5';

  return (
    <div className={`${baseClasses} ${typeClasses} ${visibilityClasses}`}>
      {message}
    </div>
  );
};

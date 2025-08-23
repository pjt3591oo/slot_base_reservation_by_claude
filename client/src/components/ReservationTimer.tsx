import React, { useEffect, useState } from 'react';
import { getTimeRemaining } from '../utils/formatters';

interface ReservationTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

const ReservationTimer: React.FC<ReservationTimerProps> = ({ expiresAt, onExpired }) => {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(expiresAt));
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(expiresAt);
      setTimeRemaining(remaining);
      
      if (remaining === '만료됨' && !isExpired) {
        setIsExpired(true);
        if (onExpired) {
          onExpired();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isExpired, onExpired]);

  const isWarning = timeRemaining !== '만료됨' && parseInt(timeRemaining) < 5;

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
      timeRemaining === '만료됨' ? 'bg-red-100 text-red-800' :
      isWarning ? 'bg-yellow-100 text-yellow-800' :
      'bg-blue-100 text-blue-800'
    }`}>
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeRemaining === '만료됨' ? '예약 시간 만료' : `남은 시간: ${timeRemaining}`}
    </div>
  );
};

export default ReservationTimer;
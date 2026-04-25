import { useEffect, useState } from 'react';
import { authTokenService } from '../hooks/useOAuth2';
import { navigate } from './Router';
import '../styles/SessionManager.scss';

const IDLE_TIMEOUT = 60 * 60 * 1000;
const CHECK_INTERVAL = 5 * 1000;

export function SessionManager() {
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  useEffect(() => {
    const manualLogout = sessionStorage.getItem('manualLogout');
    if (manualLogout === 'true') {
      sessionStorage.removeItem('manualLogout');
      return;
    }

    const handleSessionExpired = () => {
      setShowTimeoutModal(true);
    };
    window.addEventListener('session-expired', handleSessionExpired);

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    updateActivity();

    const intervalId = setInterval(() => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) return;

      const idleTime = Date.now() - parseInt(lastActivity, 10);
      
      if (idleTime > IDLE_TIMEOUT) {
        clearInterval(intervalId);
        setShowTimeoutModal(true);
      }
    }, CHECK_INTERVAL);

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, []);

  const handleLoginRedirect = () => {
    authTokenService.clearTokens();
    setShowTimeoutModal(false);
    navigate('/login');
  };

  if (!showTimeoutModal) return null;

  return (
    <div className="session-timeout-overlay">
      <div className="session-timeout-modal">
        <div className="timeout-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2>Session Timed Out</h2>
        <p>You have been inactive for a long time. Please login again to continue.</p>
        <button onClick={handleLoginRedirect} className="timeout-button">
          Login
        </button>
      </div>
    </div>
  );
}

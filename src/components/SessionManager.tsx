import { useEffect, useState } from 'react';
import { authTokenService, logout } from '../hooks/useOAuth2';
import '../styles/SessionManager.scss';

const IDLE_TIMEOUT = 60 * 60 * 1000; // 60 minutes
const CHECK_INTERVAL = 5 * 1000; // Check every 5 seconds

export function SessionManager() {
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  useEffect(() => {
    // Check if this is a manual logout
    const manualLogout = sessionStorage.getItem('manualLogout');
    if (manualLogout === 'true') {
      sessionStorage.removeItem('manualLogout');
      return; // Don't run timeout check for manual logout
    }

    // Update last activity timestamp
    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    // Track user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Initialize last activity
    updateActivity();

    // Check for idle timeout periodically
    const intervalId = setInterval(() => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) return;

      const idleTime = Date.now() - parseInt(lastActivity, 10);
      
      if (idleTime > IDLE_TIMEOUT) {
        // Session expired due to inactivity
        authTokenService.clearTokens();
        setShowTimeoutModal(true);
      }
    }, CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, []);

  const handleTimeoutClose = () => {
    setShowTimeoutModal(false);
    logout();
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
        <h2>Session Expired</h2>
        <p>You've been logged out due to inactivity.</p>
        <button onClick={handleTimeoutClose} className="timeout-button">
          Got it!
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { authTokenService, refreshAccessToken } from '../hooks/useOAuth2';
import { navigate } from './Router';
import '../styles/SessionManager.scss';

const IDLE_WARNING_MS = 5 * 60 * 1000;
const AUTO_LOGOUT_SECS = 60;
const CHECK_INTERVAL_MS = 10 * 1000;

export function SessionManager() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_LOGOUT_SECS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedAt = useRef<number | null>(null);

  const doLogout = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    authTokenService.clearTokens();
    setShowWarning(false);
    navigate('/login');
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;
    warnedAt.current = Date.now();
    setCountdown(AUTO_LOGOUT_SECS);
    setShowWarning(true);

    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (warnedAt.current ?? Date.now())) / 1000);
      const remaining = AUTO_LOGOUT_SECS - elapsed;
      if (remaining <= 0) {
        doLogout();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [doLogout]);

  const handleStayLoggedIn = useCallback(async () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    warnedAt.current = null;
    setShowWarning(false);
    setCountdown(AUTO_LOGOUT_SECS);
    localStorage.setItem('lastActivity', Date.now().toString());
    try {
      await refreshAccessToken();
    } catch {
    }
  }, []);

  const handleLoginRedirect = useCallback(() => {
    doLogout();
  }, [doLogout]);

  useEffect(() => {
    const manualLogout = sessionStorage.getItem('manualLogout');
    if (manualLogout === 'true') {
      sessionStorage.removeItem('manualLogout');
      return;
    }

    const handleSessionExpired = () => {
      if (!showWarning) startCountdown();
    };
    window.addEventListener('session-expired', handleSessionExpired);

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
      if (showWarning) handleStayLoggedIn();
    };
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    updateActivity();

    const idleChecker = setInterval(() => {
      if (showWarning) return;
      const tokens = authTokenService.getTokens();
      if (!tokens) return;

      if (authTokenService.isExpired()) {
        startCountdown();
        return;
      }

      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) return;
      const idle = Date.now() - parseInt(lastActivity, 10);
      if (idle >= IDLE_WARNING_MS) {
        startCountdown();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      activityEvents.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(idleChecker);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="session-timeout-overlay">
      <div className="session-timeout-modal">
        <div className="timeout-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2>Still there?</h2>
        <p>
          You've been idle for a while. You'll be logged out
          in <strong>{countdown} second{countdown !== 1 ? 's' : ''}</strong>.
        </p>
        <div className="timeout-actions">
          <button onClick={handleStayLoggedIn} className="timeout-button stay">
            Stay Logged In
          </button>
          <button onClick={handleLoginRedirect} className="timeout-button logout">
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useOAuth2 } from '../hooks/useOAuth2';
import { authApi, tokenService } from '../services/api';
import '../styles/Login.scss';

export function Login() {
  const [isLoadingSSO, setIsLoadingSSO] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSSOLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSSO(true);
    setError(null);
    
    try {
      await useOAuth2();
      window.location.href = '/';
    } catch (error) {
      console.error('SSO login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'SSO login failed. Please try again.';
      setError(errorMessage);
      setIsLoadingSSO(false);
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingCredentials(true);
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password');
      setIsLoadingCredentials(false);
      return;
    }
    
    try {
      const response = await authApi.login(email, password);
      tokenService.setTokens(
        response.access_token,
        response.refresh_token,
        response.expires_in
      );
      window.location.href = '/';
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials. Please try again.';
      setError(errorMessage);
      setIsLoadingCredentials(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to your account</p>
          </div>

          {error && (
            <div className="login-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCredentialsLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="text"
                id="email"
                placeholder="Enter your email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoadingCredentials || isLoadingSSO}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoadingCredentials || isLoadingSSO}
                autoComplete="current-password"
              />
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoadingCredentials || isLoadingSSO}
            >
              {isLoadingCredentials ? (
                <>
                  <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <button 
            onClick={handleSSOLogin} 
            className="sso-button"
            disabled={isLoadingCredentials || isLoadingSSO}
          >
            {isLoadingSSO ? (
              <>
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30" />
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                </svg>
                Sign In with SSO
              </>
            )}
          </button>

          {/* <div className="login-footer">
            <p>Protected by SAP BTP Authentication</p>
          </div> */}
        </div>
      </div>

      <div className="login-right">
        <div className="branding">
          <h2>BTP Copilot</h2>
          <p className="tagline">Enterprise AI Assistant powered by SAP BTP</p>
          <div className="features">
            <div className="feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Intelligent Conversations</span>
            </div>
            <div className="feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Document Analysis</span>
            </div>
            <div className="feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Secure & Scalable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

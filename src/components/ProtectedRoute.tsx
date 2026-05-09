import { type ReactNode } from 'react';
import { authTokenService } from '../hooks/useOAuth2';
import { tokenService } from '../services/api';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const hasOAuthToken = authTokenService.getTokens() && !authTokenService.isExpired();
  const hasAppToken = !!tokenService.getToken();

  if (!hasOAuthToken && !hasAppToken) {
    window.location.replace('/login');
    return null;
  }

  return <>{children}</>;
}

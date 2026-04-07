import { ReactNode } from 'react';
import { authTokenService } from '../hooks/useOAuth2';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const tokens = authTokenService.getTokens();

  // If no tokens, redirect to login
  if (!tokens) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
}

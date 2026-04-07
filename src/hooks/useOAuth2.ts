export const OAUTH_CONFIG = {
  clientId: import.meta.env.VITE_XSUAA_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_XSUAA_CLIENT_SECRET || '',
  authUrl: import.meta.env.VITE_XSUAA_AUTH_URL || '',
  tokenUrl: import.meta.env.VITE_XSUAA_TOKEN_URL || '',
  redirectUri: `${window.location.origin}/callback`,
  responseType: 'code',
  scope: 'openid',
};

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expires_at: number;
}

export const authTokenService = {
  getTokens: (): AuthTokens | null => {
    const tokens = localStorage.getItem('authTokens');
    return tokens ? JSON.parse(tokens) : null;
  },

  setTokens: (tokens: Omit<AuthTokens, 'expires_at'>) => {
    const expiresAt = Date.now() + (tokens.expires_in - 50) * 1000;
    const authTokens: AuthTokens = {
      ...tokens,
      expires_at: expiresAt,
    };
    localStorage.setItem('authTokens', JSON.stringify(authTokens));
  },

  clearTokens: () => {
    localStorage.removeItem('authTokens');
    localStorage.removeItem('lastActivity');
  },

  isExpired: (): boolean => {
    const tokens = authTokenService.getTokens();
    if (!tokens) return true;
    return Date.now() >= tokens.expires_at;
  },

  getAccessToken: (): string | null => {
    const tokens = authTokenService.getTokens();
    return tokens?.access_token || null;
  },
};

interface PopupWindow {
  window: Window | null;
  promise: Promise<AuthTokens>;
}

let currentPopup: PopupWindow | null = null;
let refreshingPromise: Promise<AuthTokens> | null = null;

function openPopup(url: string, title: string, width = 600, height = 700): Window | null {
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  
  return window.open(
    url,
    title,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function queryToObject(queryString: string): Record<string, string> {
  if (!queryString) return {};
  
  const params: Record<string, string> = {};
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  
  return params;
}

async function exchangeCodeForToken(code: string): Promise<AuthTokens> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
  });

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await response.json();
  authTokenService.setTokens(tokens);
  return tokens;
}

export async function useOAuth2(): Promise<AuthTokens> {
  if (currentPopup?.promise) {
    return currentPopup.promise;
  }

  const authUrl = `${OAUTH_CONFIG.authUrl}?${new URLSearchParams({
    response_type: OAUTH_CONFIG.responseType,
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scope,
  })}`;

  const promise = new Promise<AuthTokens>((resolve, reject) => {
    const popup = openPopup(authUrl, 'SAP Login', 600, 700);

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(intervalId);
          currentPopup = null;
          reject(new Error('Login cancelled'));
          return;
        }

        if (popup.location.hostname !== window.location.hostname) {
          return;
        }

        const queryString = popup.location.search.substring(1);
        const params = queryToObject(queryString);

        if (params.code) {
          clearInterval(intervalId);
          popup.close();
          currentPopup = null;

          try {
            const tokens = await exchangeCodeForToken(params.code);
            resolve(tokens);
          } catch (error) {
            reject(error);
          }
        } else if (params.error) {
          clearInterval(intervalId);
          popup.close();
          currentPopup = null;
          reject(new Error(params.error_description || params.error));
        }
      } catch (error) {

      }
    }, 500);

    setTimeout(() => {
      if (popup && !popup.closed) {
        clearInterval(intervalId);
        popup.close();
        currentPopup = null;
        reject(new Error('Login timeout'));
      }
    }, 5 * 60 * 1000);
  });

  currentPopup = { window: null, promise };
  return promise;
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  if (refreshingPromise) {
    return refreshingPromise;
  }

  const tokens = authTokenService.getTokens();
  if (!tokens?.refresh_token) {
    throw new Error('No refresh token available');
  }

  refreshingPromise = (async () => {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
      });

      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens = await response.json();
      authTokenService.setTokens(newTokens);
      return newTokens;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

export function logout(): void {
  authTokenService.clearTokens();
  // Set a flag to indicate manual logout (not session timeout)
  sessionStorage.setItem('manualLogout', 'true');
  window.location.href = '/login';
}

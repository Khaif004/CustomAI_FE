import type { ChatResponse, AuthResponse, User } from '../types/chat';
import { authTokenService, refreshAccessToken } from '../hooks/useOAuth2';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Custom error class with status code
export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Legacy token service for backward compatibility (dev mode)
export const tokenService = {
  getToken: () => localStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  setTokens: (access: string, refresh?: string, expiresIn?: number) => {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
    if (expiresIn) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem('token_expires_at', expiresAt.toString());
    }
  },
  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
  },
  isTokenExpired: (): boolean => {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return true;
    return Date.now() > parseInt(expiresAt, 10) - 30000; // 30s buffer
  },
};

// Get active token (prefers OAuth tokens)
const getActiveToken = (): string | null => {
  // First try OAuth tokens
  const oauthToken = authTokenService.getAccessToken();
  if (oauthToken) return oauthToken;
  
  // Fallback to legacy dev tokens
  return tokenService.getToken();
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  // Check if OAuth token is expired and refresh if needed
  if (authTokenService.getTokens() && authTokenService.isExpired()) {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  const token = getActiveToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof options.headers === 'object' && options.headers ? (options.headers as Record<string, string>) : {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 - token expired
    if (response.status === 401) {
      window.location.href = '/login';
      throw new ApiError(401, 'Unauthorized');
    }
    
    const error = await response.json().catch(() => ({ detail: 'API Error' }));
    const errorMessage = error.detail || error.message || 'API Error';
    throw new ApiError(response.status, errorMessage);
  }

  return response.json();
};

export const authApi = {
  devToken: async (username: string = 'developer'): Promise<AuthResponse> => {
    return fetch(
      `${API_BASE_URL}/api/auth/dev/token?username=${username}`
    ).then(r => {
      if (!r.ok) throw new Error('Failed to get dev token');
      return r.json();
    });
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid username or password');
    }
    return response.json();
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    return apiCall('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  getCurrentUser: async (): Promise<User> => {
    return apiCall('/api/auth/me');
  },

  logout: () => {
    tokenService.clearTokens();
  },
};

export const chatApi = {
  sendMessage: async (message: string, conversationHistory: any[] = []): Promise<ChatResponse> => {
    return apiCall('/api/chat/', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
      }),
    });
  },

  streamMessage: async (
    message: string,
    conversationHistory: any[],
    onChunk: (chunk: string) => void,
    onDone: (metadata: { model?: string; response_time?: number }) => void,
    onError: (error: string) => void,
    signal?: AbortSignal,
  ) => {
    // Check token expiry and refresh if needed
    if (authTokenService.getTokens() && authTokenService.isExpired()) {
      try {
        await refreshAccessToken();
      } catch (error) {
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    const token = getActiveToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Stream error' }));
      throw new ApiError(response.status, error.detail || 'Stream error');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              onChunk(data.content);
            } else if (data.type === 'done') {
              onDone({ model: data.model, response_time: data.response_time });
            } else if (data.type === 'error') {
              onError(data.message);
            }
          } catch {
          }
        }
      }
    }
  },

  ingestDocuments: async (documents: string[]): Promise<any> => {
    return apiCall('/api/knowledge/ingest', {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
  },

  generateTitle: async (message: string): Promise<string> => {
    const result = await apiCall('/api/chat/generate-title', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return result.title;
  },

  uploadFile: async (
    file: File,
    message: string,
    conversationHistory: any[],
    onChunk: (chunk: string) => void,
    onDone: (metadata: { model?: string; response_time?: number }) => void,
    onError: (error: string) => void,
    onFileInfo?: (info: { filename: string; size: number; truncated: boolean }) => void,
    signal?: AbortSignal,
  ) => {
    // Check token expiry and refresh if needed
    if (authTokenService.getTokens() && authTokenService.isExpired()) {
      try {
        await refreshAccessToken();
      } catch (error) {
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    const token = getActiveToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('message', message);
    formData.append('conversation_history', JSON.stringify(conversationHistory));

    const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload error' }));
      throw new ApiError(response.status, error.detail || 'Upload error');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'file_info' && onFileInfo) {
              onFileInfo({ filename: data.filename, size: data.size, truncated: data.truncated });
            } else if (data.type === 'chunk') {
              onChunk(data.content);
            } else if (data.type === 'done') {
              onDone({ model: data.model, response_time: data.response_time });
            } else if (data.type === 'error') {
              onError(data.message);
            }
          } catch {
          }
        }
      }
    }
  },
};

export const healthApi = {
  check: async (): Promise<any> => {
    return fetch(`${API_BASE_URL}/api/health`, {
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()).catch(() => ({ status: 'offline' }));
  },
};

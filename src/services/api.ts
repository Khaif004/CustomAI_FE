import type { ChatResponse, AuthResponse, User } from '../types/chat';
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

export const tokenService = {
  getToken: () => localStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  setTokens: (access: string, refresh?: string) => {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },
  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = tokenService.getToken();
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
    const error = await response.json();
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
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    return fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }).then(r => {
      if (!r.ok) throw new Error('Login failed');
      return r.json();
    });
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
  ) => {
    const token = tokenService.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
      }),
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
};

export const healthApi = {
  check: async (): Promise<any> => {
    return fetch(`${API_BASE_URL}/api/health`, {
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()).catch(() => ({ status: 'offline' }));
  },
};

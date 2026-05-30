import type { ChatResponse, AuthResponse, User } from "../types/chat";
import { authTokenService, refreshAccessToken } from "../hooks/useOAuth2";

const friendlyHttpError = (status: number, detail?: unknown): string => {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as Record<string, unknown>;
    if (typeof first?.msg === "string") return `Validation error: ${first.msg}`;
  }
  switch (status) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 413:
      return "Your message or file is too large. Please try a smaller one.";
    case 422:
      return "The server could not process your request. Please try again.";
    case 429:
      return "Too many requests. Please wait a moment before trying again.";
    case 500:
      return "The server encountered an error. Please try again shortly.";
    case 502:
      return "The AI service is temporarily unavailable. Please try again.";
    case 503:
      return "The chat service is currently unavailable. Please try again in a moment.";
    case 504:
      return "The request timed out. The AI service may be busy — please try again.";
    default:
      return `An unexpected error occurred (${status}). Please try again.`;
  }
};

const friendlyNetworkError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : "";
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network")
  )
    return "Network error. Please check your internet connection and try again.";
  if (msg.includes("abort") || msg.includes("AbortError"))
    return "Request was cancelled.";
  if (msg.includes("timeout") || msg.includes("TimeoutError"))
    return "The request timed out. Please try again.";
  return msg || "An unexpected error occurred. Please try again.";
};

const API_BASE_URL = "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const tokenService = {
  getToken: () => localStorage.getItem("access_token"),
  getRefreshToken: () => localStorage.getItem("refresh_token"),
  setTokens: (access: string, refresh?: string, expiresIn?: number) => {
    localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);
    if (expiresIn) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem("token_expires_at", expiresAt.toString());
    }
  },
  clearTokens: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expires_at");
  },
  isTokenExpired: (): boolean => {
    const expiresAt = localStorage.getItem("token_expires_at");
    if (!expiresAt) return true;
    return Date.now() > parseInt(expiresAt, 10) - 30000; // 30s buffer
  },
};

const getActiveToken = (): string | null => {
  const oauthToken = authTokenService.getAccessToken();
  if (oauthToken) return oauthToken;

  return tokenService.getToken();
};

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent("session-expired"));
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  if (authTokenService.getTokens() && authTokenService.isExpired()) {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.error("Token refresh failed:", error);
      dispatchSessionExpired();
      throw new Error("Session expired");
    }
  }

  const token = getActiveToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(typeof options.headers === "object" && options.headers
      ? (options.headers as Record<string, string>)
      : {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      dispatchSessionExpired();
      throw new ApiError(401, "Unauthorized");
    }

    const error = await response.json().catch(() => ({ detail: "" }));
    const errorMessage = friendlyHttpError(
      response.status,
      error.detail || error.message,
    );
    throw new ApiError(response.status, errorMessage);
  }

  return response.json();
};

export const authApi = {
  devToken: async (username: string = "developer"): Promise<AuthResponse> => {
    return fetch(
      `${API_BASE_URL}/api/auth/dev/token?username=${username}`,
    ).then((r) => {
      if (!r.ok) throw new Error("Failed to get dev token");
      return r.json();
    });
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Invalid username or password");
    }
    return response.json();
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token available");

    return apiCall("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  getCurrentUser: async (): Promise<User> => {
    return apiCall("/api/auth/me");
  },

  logout: () => {
    tokenService.clearTokens();
  },
};

export const chatApi = {
  sendMessage: async (
    message: string,
    conversationHistory: any[] = [],
  ): Promise<ChatResponse> => {
    return apiCall("/api/chat/", {
      method: "POST",
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
    appId?: string | null,
    onDocument?: (doc: {
      doc_type: string;
      filename: string;
      title: string;
      content_base64: string;
    }) => void,
    onDocGenerating?: (docType: string) => void,
    fioriContext?: Record<string, any> | null,
  ) => {
    if (authTokenService.getTokens() && authTokenService.isExpired()) {
      try {
        await refreshAccessToken();
      } catch {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
    }

    const token = getActiveToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
        ...(appId ? { app_id: appId } : {}),
        ...(fioriContext ? { fiori_context: fioriContext } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
      const error = await response.json().catch(() => ({ detail: "" }));
      throw new ApiError(
        response.status,
        friendlyHttpError(response.status, error.detail || error.message),
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "chunk") {
                onChunk(data.content);
              } else if (data.type === "done") {
                onDone({
                  model: data.model,
                  response_time: data.response_time,
                });
              } else if (data.type === "document") {
                onDocument?.(data);
              } else if (data.type === "doc_generating") {
                onDocGenerating?.(data.doc_type);
              } else if (data.type === "document_error") {
                onDocument?.({
                  doc_type: "error",
                  filename: "",
                  title: data.message || "Document generation failed",
                  content_base64: "",
                });
              } else if (data.type === "error") {
                onError(data.message || "The server reported an error.");
              }
            } catch (parseErr) {
              console.warn("[SSE] Failed to parse event:", line, parseErr);
            }
          }
        }
      }
    } catch (readErr) {
      if (readErr instanceof DOMException && readErr.name === "AbortError")
        throw readErr;
      onError(friendlyNetworkError(readErr));
    }
  },

  ingestDocuments: async (documents: string[]): Promise<any> => {
    return apiCall("/api/knowledge/ingest", {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
  },

  generateTitle: async (message: string): Promise<string> => {
    const result = await apiCall("/api/chat/generate-title", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return result.title;
  },

  generateDocument: async (
    topic: string,
    docType: "word" | "pdf" | "excel",
    additionalContext?: string | null,
    appId?: string | null,
  ): Promise<{ blob: Blob; filename: string }> => {
    if (authTokenService.getTokens() && authTokenService.isExpired()) {
      try {
        await refreshAccessToken();
      } catch {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
    }
    const token = getActiveToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/documents/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        topic,
        doc_type: docType,
        ...(additionalContext ? { additional_context: additionalContext } : {}),
        ...(appId ? { app_id: appId } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
      const err = await response
        .json()
        .catch(() => ({ detail: "Document generation failed" }));
      throw new ApiError(
        response.status,
        err.detail || "Document generation failed",
      );
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match
      ? match[1]
      : `document.${docType === "word" ? "docx" : docType === "excel" ? "xlsx" : "pdf"}`;
    const blob = await response.blob();
    return { blob, filename };
  },

  uploadFile: async (
    file: File,
    message: string,
    conversationHistory: any[],
    onChunk: (chunk: string) => void,
    onDone: (metadata: { model?: string; response_time?: number }) => void,
    onError: (error: string) => void,
    onFileInfo?: (info: {
      filename: string;
      size: number;
      truncated: boolean;
    }) => void,
    signal?: AbortSignal,
  ) => {
    if (authTokenService.getTokens() && authTokenService.isExpired()) {
      try {
        await refreshAccessToken();
      } catch {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
    }

    const token = getActiveToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("message", message);
    formData.append(
      "conversation_history",
      JSON.stringify(conversationHistory),
    );

    const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
      method: "POST",
      headers,
      body: formData,
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        dispatchSessionExpired();
        throw new ApiError(401, "Session expired");
      }
      const error = await response
        .json()
        .catch(() => ({ detail: "Upload error" }));
      throw new ApiError(response.status, error.detail || "Upload error");
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "file_info" && onFileInfo) {
              onFileInfo({
                filename: data.filename,
                size: data.size,
                truncated: data.truncated,
              });
            } else if (data.type === "chunk") {
              onChunk(data.content);
            } else if (data.type === "done") {
              onDone({ model: data.model, response_time: data.response_time });
            } else if (data.type === "error") {
              onError(data.message);
            }
          } catch {}
        }
      }
    }
  },
};

export const healthApi = {
  check: async (): Promise<any> => {
    return fetch(`${API_BASE_URL}/api/health`, {
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .catch(() => ({ status: "offline" }));
  },
};

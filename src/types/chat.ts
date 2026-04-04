export interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  responseTime?: number;
  reaction?: 'thumbs-up' | 'thumbs-down' | null;
  attachment?: FileAttachment;
}

export interface ChatResponse {
  response: string;
  model: string;
  response_time: number;
  tokens_used?: number;
  conversation_id?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface User {
  sub: string;
  username: string;
  exp: number;
}

export interface ApiError {
  detail: string | { msg: string }[];
}

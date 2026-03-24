/*merge changes*/
import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, Conversation } from "../types/chat";
import { chatApi, authApi, tokenService, ApiError } from "../services/api";

const STORAGE_KEY = "chatbot_conversations";

export const useChatbot = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string>(
    () => {
      const saved = localStorage.getItem("currentConversation");
      return saved || (Math.random().toString(36).slice(2) as string);
    },
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!tokenService.getToken(),
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get or create current conversation
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  ) || {
    id: currentConversationId,
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save conversations to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("currentConversation", currentConversationId);
  }, [currentConversationId]);

  // Authenticate with dev token
  const authenticate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await authApi.devToken("developer");
      tokenService.setTokens(result.access_token, result.refresh_token);
      setIsAuthenticated(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!isAuthenticated) {
        setError("Not authenticated");
        return;
      }

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setConversations((prev) => {
        const updated = [...prev];
        const convIndex = updated.findIndex(
          (c) => c.id === currentConversationId,
        );
        if (convIndex >= 0) {
          updated[convIndex].messages.push(userMessage);
          updated[convIndex].updatedAt = new Date();
        } else {
          updated.push({
            ...currentConversation,
            messages: [userMessage],
          });
        }
        return updated;
      });

      // Update title if it's the first message
      if (currentConversation.messages.length === 0) {
        const title =
          content.substring(0, 50) + (content.length > 50 ? "..." : "");
        setConversations((prev) => {
          const updated = [...prev];
          const convIndex = updated.findIndex(
            (c) => c.id === currentConversationId,
          );
          if (convIndex >= 0) updated[convIndex].title = title;
          return updated;
        });
      }

      setIsLoading(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        const response = await chatApi.sendMessage(
          content,
          currentConversation.messages,
        );

        const assistantMessage: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
          modelUsed: response.model,
          responseTime: response.response_time,
        };

        setConversations((prev) => {
          const updated = [...prev];
          const convIndex = updated.findIndex(
            (c) => c.id === currentConversationId,
          );
          if (convIndex >= 0) {
            updated[convIndex].messages.push(assistantMessage);
            updated[convIndex].updatedAt = new Date();
          }
          return updated;
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";

        // Check if it's a 401 (Unauthorized) error - token expired
        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
          tokenService.clearTokens();
          setError("Your session has expired. Please sign in again.");
        } else {
          setError(message);
        }

        // Remove user message on error
        setConversations((prev) => {
          const updated = [...prev];
          const convIndex = updated.findIndex(
            (c) => c.id === currentConversationId,
          );
          if (convIndex >= 0) {
            updated[convIndex].messages = updated[convIndex].messages.filter(
              (m) => m.id !== userMessage.id,
            );
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, isAuthenticated, currentConversation],
  );

  // New conversation
  const newConversation = useCallback(() => {
    const id = Math.random().toString(36).slice(2);
    setCurrentConversationId(id);
    setError(null);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        newConversation();
      }
    },
    [currentConversationId, newConversation],
  );

  // Clear all conversations
  const clearAll = useCallback(() => {
    if (confirm("Clear all conversations?")) {
      setConversations([]);
      newConversation();
      setError(null);
    }
  }, [newConversation]);

  // Stop generating
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    conversations,
    currentConversation,
    isLoading,
    error,
    isAuthenticated,

    // Actions
    authenticate,
    sendMessage,
    newConversation,
    deleteConversation,
    clearAll,
    stopGenerating,
    setCurrentConversationId,
  };
};

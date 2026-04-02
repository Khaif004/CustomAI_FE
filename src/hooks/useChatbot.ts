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
  const [isStreaming, setIsStreaming] = useState(false);
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

  // Send message with streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!isAuthenticated) {
        setError("Not authenticated");
        return;
      }

      const userMessage: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Add user message immediately
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

      const assistantMessageId = Math.random().toString(36).slice(2);

      try {
        await chatApi.streamMessage(
          content,
          currentConversation.messages,
          (chunk: string) => {
            // On first chunk, create the assistant message; on subsequent chunks, append
            setConversations((prev) => {
              return prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                const existingMsg = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (!existingMsg) {
                  // First chunk - add assistant message
                  setIsStreaming(true);
                  return {
                    ...c,
                    messages: [
                      ...c.messages,
                      {
                        id: assistantMessageId,
                        role: "assistant" as const,
                        content: chunk,
                        timestamp: new Date(),
                      },
                    ],
                    updatedAt: new Date(),
                  };
                }
                // Append chunk to existing message
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: m.content + chunk }
                      : m,
                  ),
                };
              });
            });
          },
          (metadata) => {
            // Stream done - update metadata
            setConversations((prev) => {
              return prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          modelUsed: metadata.model,
                          responseTime: metadata.response_time,
                        }
                      : m,
                  ),
                };
              });
            });
            setIsStreaming(false);
            setIsLoading(false);
          },
          (errorMsg: string) => {
            setError(errorMsg);
            setIsStreaming(false);
            setIsLoading(false);
          },
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";

        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
          tokenService.clearTokens();
          setError("Your session has expired. Please sign in again.");
        } else {
          setError(message);
        }

        // Remove user message and any partial assistant message on error
        setConversations((prev) => {
          return prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            return {
              ...c,
              messages: c.messages.filter(
                (m) =>
                  m.id !== userMessage.id && m.id !== assistantMessageId,
              ),
            };
          });
        });
        setIsStreaming(false);
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
    isStreaming,
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

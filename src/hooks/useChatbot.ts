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

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  ) || {
    id: currentConversationId,
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("currentConversation", currentConversationId);
  }, [currentConversationId]);

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

      if (currentConversation.messages.length === 0) {
        const tempTitle = content.substring(0, 40).replace(/\s+\S*$/, "") + "...";
        const convId = currentConversationId;
        setConversations((prev) => {
          const updated = [...prev];
          const convIndex = updated.findIndex((c) => c.id === convId);
          if (convIndex >= 0) updated[convIndex].title = tempTitle;
          return updated;
        });
        chatApi.generateTitle(content).then((aiTitle) => {
          setConversations((prev) => {
            const updated = [...prev];
            const convIndex = updated.findIndex((c) => c.id === convId);
            if (convIndex >= 0) updated[convIndex].title = aiTitle;
            return updated;
          });
        }).catch(() => {});
      }

      setIsLoading(true);
      setError(null);

      const assistantMessageId = Math.random().toString(36).slice(2);
      abortControllerRef.current = new AbortController();

      try {
        await chatApi.streamMessage(
          content,
          currentConversation.messages,
          (chunk: string) => {
            setConversations((prev) => {
              return prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                const existingMsg = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (!existingMsg) {
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
          abortControllerRef.current?.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsStreaming(false);
          setIsLoading(false);
          return;
        }

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

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  // Send message with file attachment
  const sendMessageWithFile = useCallback(
    async (file: File, message: string) => {
      if (!isAuthenticated) {
        setError("Not authenticated");
        return;
      }

      const displayMessage = message.trim() || `Analyze this file: ${file.name}`;
      const userMessage: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content: displayMessage,
        timestamp: new Date(),
        attachment: { name: file.name, size: file.size, type: file.type },
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
          updated.push({ ...currentConversation, messages: [userMessage] });
        }
        return updated;
      });

      if (currentConversation.messages.length === 0) {
        const title = `📎 ${file.name}`;
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
      abortControllerRef.current = new AbortController();

      try {
        await chatApi.uploadFile(
          file,
          message,
          currentConversation.messages,
          (chunk: string) => {
            setConversations((prev) => {
              return prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                const existingMsg = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (!existingMsg) {
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
          undefined,
          abortControllerRef.current?.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsStreaming(false);
          setIsLoading(false);
          return;
        }
        const errMessage =
          err instanceof Error ? err.message : "Failed to upload file";

        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
          tokenService.clearTokens();
          setError("Your session has expired. Please sign in again.");
        } else {
          setError(errMessage);
        }

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

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const msgIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (msgIndex === -1) return;

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConversationId) return c;
          return {
            ...c,
            messages: c.messages.slice(0, msgIndex),
            updatedAt: new Date(),
          };
        }),
      );

      await sendMessage(newContent);
    },
    [currentConversationId, currentConversation, sendMessage],
  );

  const regenerateLastResponse = useCallback(async () => {
    const messages = currentConversation.messages;
    let lastUserMessage: ChatMessage | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i];
        break;
      }
    }
    if (!lastUserMessage) return;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConversationId) return c;
        const lastAssistantIdx = c.messages.findLastIndex(
          (m) => m.role === "assistant",
        );
        if (lastAssistantIdx === -1) return c;
        return {
          ...c,
          messages: c.messages.filter((_, i) => i !== lastAssistantIdx),
          updatedAt: new Date(),
        };
      }),
    );

    await sendMessage(lastUserMessage.content);
  }, [currentConversationId, currentConversation, sendMessage]);

  const reactToMessage = useCallback(
    (messageId: string, reaction: "thumbs-up" | "thumbs-down" | null) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConversationId) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId
                ? { ...m, reaction: m.reaction === reaction ? null : reaction }
                : m,
            ),
          };
        }),
      );
    },
    [currentConversationId],
  );

  return {
    conversations,
    currentConversation,
    isLoading,
    isStreaming,
    error,
    isAuthenticated,

    authenticate,
    sendMessage,
    sendMessageWithFile,
    newConversation,
    deleteConversation,
    clearAll,
    stopGenerating,
    setCurrentConversationId,
    editMessage,
    regenerateLastResponse,
    reactToMessage,
  };
};

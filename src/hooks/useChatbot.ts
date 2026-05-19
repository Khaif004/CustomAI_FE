import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, Conversation } from "../types/chat";
import { chatApi, authApi, tokenService, ApiError } from "../services/api";
import { authTokenService, logout as oauthLogout, refreshAccessToken } from "./useOAuth2";

const STORAGE_KEY = "chatbot_conversations";

const checkAuthentication = (): boolean => {
  const oauthTokens = authTokenService.getTokens();
  if (oauthTokens && !authTokenService.isExpired()) {
    return true;
  }

  return !!tokenService.getToken();
};

export const useChatbot = (appId?: string | null) => {
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
    checkAuthentication(),
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingTextRef = useRef<string>('');
  const typewriterRunningRef = useRef<boolean>(false);
  const typewriterCtxRef = useRef<{ msgId: string; convId: string } | null>(null);
  const streamDoneRef = useRef<boolean>(false);
  const streamDoneCallbackRef = useRef<(() => void) | null>(null);
  const typewriterWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const code = `
      let id = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (id) return;
          id = setInterval(() => self.postMessage('tick'), ${30});
        } else if (e.data === 'stop') {
          clearInterval(id); id = null;
        }
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    typewriterWorkerRef.current = worker;
    return () => { worker.terminate(); typewriterWorkerRef.current = null; };
  }, []);

  const startTypewriter = useCallback((msgId: string, convId: string) => {
    if (typewriterRunningRef.current) {
      typewriterCtxRef.current = { msgId, convId };
      return;
    }
    typewriterRunningRef.current = true;
    typewriterCtxRef.current = { msgId, convId };

    const worker = typewriterWorkerRef.current;
    if (!worker) return;

    worker.onmessage = () => {
      const ctx = typewriterCtxRef.current;
      const pending = pendingTextRef.current;

      if (!pending) {
        if (streamDoneRef.current) {
          worker.postMessage('stop');
          typewriterRunningRef.current = false;
          typewriterCtxRef.current = null;
          streamDoneRef.current = false;
          const cb = streamDoneCallbackRef.current;
          streamDoneCallbackRef.current = null;
          cb?.();
        }
        return;
      }

      if (!ctx) return;

      const speed = 4;
      const toRender = pending.slice(0, speed);
      pendingTextRef.current = pending.slice(speed);

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== ctx.convId) return c;
          const existingMsg = c.messages.find((m) => m.id === ctx.msgId);
          if (!existingMsg) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { id: ctx.msgId, role: 'assistant' as const, content: toRender, timestamp: new Date() },
              ],
              updatedAt: new Date(),
            };
          }
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === ctx.msgId ? { ...m, content: m.content + toRender } : m,
            ),
          };
        }),
      );
    };

    worker.postMessage('start');
  }, []);

  const stopTypewriter = useCallback(() => {
    streamDoneRef.current = false;
    streamDoneCallbackRef.current = null;
    if (typewriterRunningRef.current) {
      typewriterWorkerRef.current?.postMessage('stop');
      typewriterRunningRef.current = false;
    }
    const remaining = pendingTextRef.current;
    pendingTextRef.current = '';
    const ctx = typewriterCtxRef.current;
    if (remaining && ctx) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== ctx.convId) return c;
          const existingMsg = c.messages.find((m) => m.id === ctx.msgId);
          if (!existingMsg) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { id: ctx.msgId, role: 'assistant' as const, content: remaining, timestamp: new Date() },
              ],
              updatedAt: new Date(),
            };
          }
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === ctx.msgId ? { ...m, content: m.content + remaining } : m,
            ),
          };
        }),
      );
    }
    typewriterCtxRef.current = null;
  }, []);

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

  useEffect(() => {
    return () => {
      typewriterWorkerRef.current?.postMessage('stop');
    };
  }, []);


  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await authApi.login(username, password);
      tokenService.setTokens(result.access_token, result.refresh_token, result.expires_in);
      setIsAuthenticated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid username or password";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    oauthLogout(); // This clears tokens and navigates to /login
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authApi.refreshToken();
      tokenService.setTokens(result.access_token, result.refresh_token, result.expires_in);
      setIsAuthenticated(true);
      return true;
    } catch {
      tokenService.clearTokens();
      setIsAuthenticated(false);
      setError("Session expired. Please log in again.");
      return false;
    }
  }, []);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    const oauthTokens = authTokenService.getTokens();
    if (oauthTokens) {
      if (!authTokenService.isExpired()) {
        const tokens = authTokenService.getTokens()!;
        const msLeft = tokens.expires_at - Date.now();
        if (msLeft < 2 * 60 * 1000) {
          try { await refreshAccessToken(); } catch {  }
        }
        setIsAuthenticated(true);
        return true;
      }
      try {
        await refreshAccessToken();
        setIsAuthenticated(true);
        return true;
      } catch {
        setIsAuthenticated(false);
        return false;
      }
    }

    if (!tokenService.getToken()) {
      setIsAuthenticated(false);
      return false;
    }
    if (tokenService.isTokenExpired()) {
      if (tokenService.getRefreshToken()) {
        return await refreshAuth();
      }
      tokenService.clearTokens();
      setIsAuthenticated(false);
      setError("Session expired. Please log in again.");
      return false;
    }
    return true;
  }, [refreshAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (!authTokenService.getTokens() && tokenService.isTokenExpired()) {
        if (tokenService.getRefreshToken()) {
          refreshAuth();
        } else {
          tokenService.clearTokens();
          setIsAuthenticated(false);
          setError("Session expired. Please log in again.");
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshAuth]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!(await ensureAuth())) {
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
        }).catch(() => { });
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
            setIsStreaming(true);
            pendingTextRef.current += chunk;
            startTypewriter(assistantMessageId, currentConversationId);
          },
          (metadata) => {
            const finish = () => {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== currentConversationId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, modelUsed: metadata.model, responseTime: metadata.response_time }
                        : m,
                    ),
                  };
                }),
              );
              setIsStreaming(false);
              setIsLoading(false);
            };
            if (typewriterRunningRef.current) {
              streamDoneRef.current = true;
              streamDoneCallbackRef.current = finish;
            } else {
              finish();
            }
          },
          (errorMsg: string) => {
            setError(errorMsg);
            setIsStreaming(false);
            setIsLoading(false);
          },
          abortControllerRef.current?.signal,
          appId,
          (doc) => {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, isGeneratingDoc: false, generatedDocument: { doc_type: doc.doc_type as any, filename: doc.filename, title: doc.title, content_base64: doc.content_base64 } }
                      : m,
                  ),
                };
              }),
            );
          },
          (docType: string) => {
            // Pre-create the assistant message so the spinner shows immediately
            setIsStreaming(true);
            typewriterCtxRef.current = { msgId: assistantMessageId, convId: currentConversationId };
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== currentConversationId) return c;
                const exists = c.messages.find((m) => m.id === assistantMessageId);
                if (exists) return c;
                return {
                  ...c,
                  messages: [
                    ...c.messages,
                    { id: assistantMessageId, role: 'assistant' as const, content: '', timestamp: new Date(), isGeneratingDoc: true },
                  ],
                  updatedAt: new Date(),
                };
              }),
            );
            void docType; // used by backend, kept for future labelling
          },
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
          authTokenService.clearTokens();
          window.dispatchEvent(new CustomEvent('session-expired'));
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
      stopTypewriter();
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, [stopTypewriter]);

  // Send message with file attachment
  const sendMessageWithFile = useCallback(
    async (file: File, message: string) => {
      if (!(await ensureAuth())) {
        setError("Session expired. Please log in again.");
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
            setIsStreaming(true);
            pendingTextRef.current += chunk;
            startTypewriter(assistantMessageId, currentConversationId);
          },
          (metadata) => {
            const finish = () => {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== currentConversationId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, modelUsed: metadata.model, responseTime: metadata.response_time }
                        : m,
                    ),
                  };
                }),
              );
              setIsStreaming(false);
              setIsLoading(false);
            };
            if (typewriterRunningRef.current) {
              streamDoneRef.current = true;
              streamDoneCallbackRef.current = finish;
            } else {
              finish();
            }
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
          authTokenService.clearTokens();
          window.dispatchEvent(new CustomEvent('session-expired'));
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

    login,
    logout,
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

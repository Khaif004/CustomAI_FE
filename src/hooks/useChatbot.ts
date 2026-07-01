import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, Conversation, User } from "../types/chat";
import type { ToolCallEvent } from "../types/tools";
import {
  chatApi,
  authApi,
  tokenService,
  ApiError,
  getUserFromToken,
} from "../services/api";
import {
  authTokenService,
  logout as oauthLogout,
  refreshAccessToken,
} from "./useOAuth2";

const STORAGE_KEY = "chatbot_conversations";
const CURRENT_CONV_KEY = "currentConversation";

const UNLOADED = "__btp_unloaded__";

const isEmbedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const checkAuthentication = (): boolean => {
  const oauthTokens = authTokenService.getTokens();
  if (oauthTokens && !authTokenService.isExpired()) {
    return true;
  }

  return !!tokenService.getToken();
};

export interface ExecStep {
  id: string;
  label: string;
  status: "active" | "done" | "error" | "pending";
  num?: number;
}

export const useChatbot = (
  appId?: string | null,
  onToolCall?: (data: ToolCallEvent) => void,
  onToolResult?: (data: Record<string, unknown>) => void,
) => {

  const [embeddedAppId, setEmbeddedAppId] = useState<string | null>(null);
  const [execSteps, setExecSteps] = useState<ExecStep[]>([]);

  const effectiveAppId = embeddedAppId ?? appId ?? null;

  const storageKey = effectiveAppId
    ? `${STORAGE_KEY}:${effectiveAppId}`
    : `${STORAGE_KEY}:global`;
  const currentConvStorageKey = effectiveAppId
    ? `${CURRENT_CONV_KEY}:${effectiveAppId}`
    : `${CURRENT_CONV_KEY}:global`;

  const initStorageKey = appId
    ? `${STORAGE_KEY}:${appId}`
    : `${STORAGE_KEY}:global`;
  const initConvKey = appId
    ? `${CURRENT_CONV_KEY}:${appId}`
    : `${CURRENT_CONV_KEY}:global`;

  const startsUnloaded = isEmbedded && !appId;

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (startsUnloaded) return [];
    const saved = localStorage.getItem(initStorageKey);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string>(
    () => {
      const saved = localStorage.getItem(initConvKey);
      return saved || (Math.random().toString(36).slice(2) as string);
    },
  );

  const loadedAppIdRef = useRef<string | null>(
    startsUnloaded ? UNLOADED : appId ?? null,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuthentication());
  const [user, setUser] = useState<User | null>(() => getUserFromToken());
  const [fioriContext, setFioriContext] = useState<Record<string, any> | null>(
    null,
  );
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const streamGenerationsRef = useRef<Map<string, number>>(new Map());
  const currentConvIdRef = useRef<string>(currentConversationId);
  const pendingTextRef = useRef<string>("");
  const typewriterRunningRef = useRef<boolean>(false);
  const typewriterCtxRef = useRef<{ msgId: string; convId: string } | null>(
    null,
  );
  const streamDoneRef = useRef<boolean>(false);
  const streamDoneCallbackRef = useRef<(() => void) | null>(null);
  const typewriterWorkerRef = useRef<Worker | null>(null);
  const prevConvIdRef = useRef<string>(currentConversationId);

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
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    typewriterWorkerRef.current = worker;
    return () => {
      worker.terminate();
      typewriterWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { type, payload, token } = event.data as {
        type?: string;
        payload?: Record<string, any>;
        token?: string;
      };
      if (type === "btp-copilot:set-context" && payload) {
        setFioriContext(payload);
        if (payload.app_id) setEmbeddedAppId(payload.app_id);
      }
      if (type === "btp-copilot:auth" && token) {
        localStorage.setItem("access_token", token);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
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
          worker.postMessage("stop");
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
                {
                  id: ctx.msgId,
                  role: "assistant" as const,
                  content: toRender,
                  timestamp: new Date(),
                },
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

    worker.postMessage("start");
  }, []);

  const stopTypewriter = useCallback(() => {
    streamDoneRef.current = false;
    streamDoneCallbackRef.current = null;
    if (typewriterRunningRef.current) {
      typewriterWorkerRef.current?.postMessage("stop");
      typewriterRunningRef.current = false;
    }
    const remaining = pendingTextRef.current;
    pendingTextRef.current = "";
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
                {
                  id: ctx.msgId,
                  role: "assistant" as const,
                  content: remaining,
                  timestamp: new Date(),
                },
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

    if (loadedAppIdRef.current !== effectiveAppId) return;
    localStorage.setItem(storageKey, JSON.stringify(conversations));
  }, [conversations, storageKey, effectiveAppId]);

  useEffect(() => {
    if (loadedAppIdRef.current !== effectiveAppId) return;
    localStorage.setItem(currentConvStorageKey, currentConversationId);
  }, [currentConversationId, currentConvStorageKey, effectiveAppId]);

  const prevEffectiveAppIdRef = useRef<string | null>(appId ?? null);
  useEffect(() => {
    const newKey = effectiveAppId
      ? `${STORAGE_KEY}:${effectiveAppId}`
      : `${STORAGE_KEY}:global`;
    const newConvKey = effectiveAppId
      ? `${CURRENT_CONV_KEY}:${effectiveAppId}`
      : `${CURRENT_CONV_KEY}:global`;

    if (prevEffectiveAppIdRef.current === effectiveAppId) return;
    prevEffectiveAppIdRef.current = effectiveAppId;

    const saved = localStorage.getItem(newKey);
    setConversations(saved ? JSON.parse(saved) : []);

    const savedConvId = localStorage.getItem(newConvKey);
    setCurrentConversationId(
      savedConvId || Math.random().toString(36).slice(2),
    );

    // Loaded conversations now belong to this context; re-enable persistence.
    loadedAppIdRef.current = effectiveAppId;
  }, [effectiveAppId]);

  useEffect(() => {
    currentConvIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    if (prevConvIdRef.current === currentConversationId) return;
    prevConvIdRef.current = currentConversationId;
    stopTypewriter();
    const hasActiveStream = abortControllersRef.current.has(
      currentConversationId,
    );
    setIsStreaming(hasActiveStream);
    setIsLoading(hasActiveStream);
  }, [currentConversationId, stopTypewriter]);

  useEffect(() => {
    return () => {
      typewriterWorkerRef.current?.postMessage("stop");
    };
  }, []);

  // Resolve the logged-in user's display info. Decode the token immediately
  // (instant, offline), then refine with the authoritative /api/auth/me.
  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      return;
    }

    const local = getUserFromToken();
    if (local) setUser(local);

    let cancelled = false;
    authApi
      .getCurrentUser()
      .then((u) => {
        if (cancelled || !u) return;
        setUser((prev) => {
          const backendName =
            u.username && u.username !== "unknown" ? u.username : null;
          return {
            user_id: u.user_id || prev?.user_id || "",
            username: backendName || prev?.username || u.username,
            email: u.email ?? prev?.email ?? null,
            display_name:
              u.display_name || prev?.display_name || backendName || null,
          };
        });
      })
      .catch(() => {
        /* token-decoded user is sufficient; ignore /me failures */
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await authApi.login(username, password);
      tokenService.setTokens(
        result.access_token,
        result.refresh_token,
        result.expires_in,
      );
      setIsAuthenticated(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid username or password";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    oauthLogout();
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authApi.refreshToken();
      tokenService.setTokens(
        result.access_token,
        result.refresh_token,
        result.expires_in,
      );
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
          try {
            await refreshAccessToken();
          } catch {}
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
        const tempTitle =
          content.substring(0, 40).replace(/\s+\S*$/, "") + "...";
        const convId = currentConversationId;
        setConversations((prev) => {
          const updated = [...prev];
          const convIndex = updated.findIndex((c) => c.id === convId);
          if (convIndex >= 0) updated[convIndex].title = tempTitle;
          return updated;
        });
        chatApi
          .generateTitle(content)
          .then((aiTitle) => {
            setConversations((prev) => {
              const updated = [...prev];
              const convIndex = updated.findIndex((c) => c.id === convId);
              if (convIndex >= 0) updated[convIndex].title = aiTitle;
              return updated;
            });
          })
          .catch(() => {});
      }

      setIsLoading(true);
      setError(null);

      const existingCtrl = abortControllersRef.current.get(
        currentConversationId,
      );
      if (existingCtrl) {
        existingCtrl.abort();
        abortControllersRef.current.delete(currentConversationId);
      }
      if (
        !typewriterCtxRef.current ||
        typewriterCtxRef.current.convId === currentConversationId
      ) {
        pendingTextRef.current = "";
        streamDoneRef.current = false;
        streamDoneCallbackRef.current = null;
        if (typewriterRunningRef.current) {
          typewriterWorkerRef.current?.postMessage("stop");
          typewriterRunningRef.current = false;
          typewriterCtxRef.current = null;
        }
      }

      const convIdAtSendTime = currentConversationId;
      const gen = (streamGenerationsRef.current.get(convIdAtSendTime) || 0) + 1;
      streamGenerationsRef.current.set(convIdAtSendTime, gen);
      const myGen = gen;

      const assistantMessageId = Math.random().toString(36).slice(2);
      const controller = new AbortController();
      abortControllersRef.current.set(convIdAtSendTime, controller);

      try {
        await chatApi.streamMessage(
          content,
          currentConversation.messages,
          (chunk: string) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            if (currentConvIdRef.current === convIdAtSendTime) {
              setIsStreaming(true);
              pendingTextRef.current += chunk;
              startTypewriter(assistantMessageId, convIdAtSendTime);
            } else {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convIdAtSendTime) return c;
                  const existingMsg = c.messages.find(
                    (m) => m.id === assistantMessageId,
                  );
                  if (existingMsg) {
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: m.content + chunk }
                          : m,
                      ),
                    };
                  }
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
                }),
              );
            }
          },
          (metadata) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            abortControllersRef.current.delete(convIdAtSendTime);
            const isForeground = currentConvIdRef.current === convIdAtSendTime;
            const finish = () => {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convIdAtSendTime) return c;
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
                }),
              );
              if (isForeground) {
                setIsStreaming(false);
                setIsLoading(false);
              }
            };
            if (typewriterRunningRef.current && isForeground) {
              streamDoneRef.current = true;
              streamDoneCallbackRef.current = finish;
            } else {
              finish();
            }
          },
          (errorMsg: string) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            abortControllersRef.current.delete(convIdAtSendTime);
            if (currentConvIdRef.current === convIdAtSendTime) {
              stopTypewriter();
            }
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convIdAtSendTime) return c;
                const existingMsg = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (existingMsg) {
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            isGeneratingDoc: false,
                            errorMessage: errorMsg,
                          }
                        : m,
                    ),
                  };
                }
                return {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: assistantMessageId,
                      role: "assistant" as const,
                      content: "",
                      timestamp: new Date(),
                      errorMessage: errorMsg,
                    },
                  ],
                  updatedAt: new Date(),
                };
              }),
            );
            if (currentConvIdRef.current === convIdAtSendTime) {
              setIsStreaming(false);
              setIsLoading(false);
            }
          },
          controller.signal,
          effectiveAppId,
          (doc) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convIdAtSendTime) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          isGeneratingDoc: false,
                          generatedDocument: {
                            doc_type: doc.doc_type as any,
                            filename: doc.filename,
                            title: doc.title,
                            content_base64: doc.content_base64,
                          },
                        }
                      : m,
                  ),
                };
              }),
            );
          },
          (docType: string) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            if (currentConvIdRef.current === convIdAtSendTime) {
              setIsStreaming(true);
            }
            typewriterCtxRef.current = {
              msgId: assistantMessageId,
              convId: convIdAtSendTime,
            };
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convIdAtSendTime) return c;
                const exists = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (exists) return c;
                return {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: assistantMessageId,
                      role: "assistant" as const,
                      content: "",
                      timestamp: new Date(),
                      isGeneratingDoc: true,
                    },
                  ],
                  updatedAt: new Date(),
                };
              }),
            );
            void docType;
          },
          fioriContext,
          onToolCall,
          (data) => {
            // Handle UI_ACTION tool_result events from inline backend execution
            if (data.execution_type === "UI_ACTION" && data.frontend_event) {
              const eventName = data.frontend_event as string;
              const payload   = (data.payload ?? {}) as Record<string, unknown>;
              window.dispatchEvent(new CustomEvent(eventName, { detail: payload, bubbles: true }));
              // Primary channel: postMessage to parent (works when embedded in widget iframe)
              window.parent.postMessage({ type: "btp-copilot:ui-action", event: eventName, payload }, "*");
              // Relay channel: POST to backend so the widget can poll even when standalone
              if (eventName === "BTP_NAVIGATE" && payload.app_id) {
                fetch("/api/navigation/pending", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }).catch(() => { /* non-critical */ });
              }
            }
            onToolResult?.(data);
            // Clear execution steps after a short pause so the result chunk renders first
            setTimeout(() => setExecSteps([]), 900);
          },
          (ev) => {
            // Ordered pipeline steps — used to pre-populate pending steps
            const STEP_ORDER = ["analyzing", "found", "preparing", "executing"];
            const ACTIVE_LABELS: Record<string, string> = {
              analyzing: "Analyzing your request",
              found:     `Identified: ${ev.tool ?? "action"}`,
              preparing: `Preparing${ev.entity ? ` for ${ev.entity}` : ""} request`,
              executing: "Sending to CAP service",
            };
            const PENDING_LABELS: Record<string, string> = {
              found:     "Identifying action",
              preparing: "Preparing request",
              executing: "Executing action",
            };

            setExecSteps((prev) => {
              // Terminal events: clear pending, mark active as done or error
              if (ev.step === "success" || ev.step === "error") {
                const terminal = ev.step === "success" ? "done" as const : "error" as const;
                return prev
                  .filter((s) => s.status !== "pending")
                  .map((s) => (s.status === "active" ? { ...s, status: terminal } : s));
              }

              // Mark current active → done, remove stale pending placeholders
              const base = prev
                .map((s) => (s.status === "active" ? { ...s, status: "done" as const } : s))
                .filter((s) => s.status !== "pending");

              // New active step
              const newActive: ExecStep = {
                id:     ev.step,
                label:  ACTIVE_LABELS[ev.step] ?? ev.step,
                status: "active",
                num:    ev.step_num,
              };

              // Pre-populate remaining steps as pending
              const stepIdx = STEP_ORDER.indexOf(ev.step);
              const pending: ExecStep[] = stepIdx >= 0
                ? STEP_ORDER.slice(stepIdx + 1).map((id, i) => ({
                    id,
                    label:  PENDING_LABELS[id] ?? id,
                    status: "pending" as const,
                    num:    (ev.step_num ?? stepIdx + 1) + i + 1,
                  }))
                : [];

              return [...base, newActive, ...pending];
            });
          },
        );
      } catch (err) {
        abortControllersRef.current.delete(convIdAtSendTime);
        if (err instanceof DOMException && err.name === "AbortError") {
          if (currentConvIdRef.current === convIdAtSendTime) {
            setIsStreaming(false);
            setIsLoading(false);
          }
          return;
        }

        const message =
          err instanceof Error ? err.message : "Failed to send message";

        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
          tokenService.clearTokens();
          authTokenService.clearTokens();
          window.dispatchEvent(new CustomEvent("session-expired"));
          if (currentConvIdRef.current === convIdAtSendTime) {
            setIsStreaming(false);
          }
        } else {
          if (currentConvIdRef.current === convIdAtSendTime) {
            stopTypewriter();
          }
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convIdAtSendTime) return c;
              const existingMsg = c.messages.find(
                (m) => m.id === assistantMessageId,
              );
              if (existingMsg) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, isGeneratingDoc: false, errorMessage: message }
                      : m,
                  ),
                };
              }
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: assistantMessageId,
                    role: "assistant" as const,
                    content: "",
                    timestamp: new Date(),
                    errorMessage: message,
                  },
                ],
                updatedAt: new Date(),
              };
            }),
          );
          if (currentConvIdRef.current === convIdAtSendTime) {
            setIsStreaming(false);
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, isAuthenticated, currentConversation, effectiveAppId],
  );

  const newConversation = useCallback(() => {
    const id = Math.random().toString(36).slice(2);
    setCurrentConversationId(id);
    setError(null);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        newConversation();
      }
    },
    [currentConversationId, newConversation],
  );

  const clearAll = useCallback(() => {
    if (confirm("Clear all conversations?")) {
      setConversations([]);
      newConversation();
      setError(null);
    }
  }, [newConversation]);

  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
    );
  }, []);

  const togglePinConversation = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    );
  }, []);

  const stopGenerating = useCallback(() => {
    const ctrl = abortControllersRef.current.get(currentConversationId);
    if (ctrl) {
      ctrl.abort();
      abortControllersRef.current.delete(currentConversationId);
      stopTypewriter();
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, [currentConversationId, stopTypewriter]);

  const sendMessageWithFile = useCallback(
    async (file: File, message: string) => {
      if (!(await ensureAuth())) {
        setError("Session expired. Please log in again.");
        return;
      }

      const displayMessage =
        message.trim() || `Analyze this file: ${file.name}`;
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

      const existingFileCtrl = abortControllersRef.current.get(
        currentConversationId,
      );
      if (existingFileCtrl) {
        existingFileCtrl.abort();
        abortControllersRef.current.delete(currentConversationId);
      }
      if (
        !typewriterCtxRef.current ||
        typewriterCtxRef.current.convId === currentConversationId
      ) {
        pendingTextRef.current = "";
        streamDoneRef.current = false;
        streamDoneCallbackRef.current = null;
        if (typewriterRunningRef.current) {
          typewriterWorkerRef.current?.postMessage("stop");
          typewriterRunningRef.current = false;
          typewriterCtxRef.current = null;
        }
      }

      const convIdAtSendTime = currentConversationId;
      const gen = (streamGenerationsRef.current.get(convIdAtSendTime) || 0) + 1;
      streamGenerationsRef.current.set(convIdAtSendTime, gen);
      const myGen = gen;

      const assistantMessageId = Math.random().toString(36).slice(2);
      const controller = new AbortController();
      abortControllersRef.current.set(convIdAtSendTime, controller);

      try {
        await chatApi.uploadFile(
          file,
          message,
          currentConversation.messages,
          (chunk: string) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            if (currentConvIdRef.current === convIdAtSendTime) {
              setIsStreaming(true);
              pendingTextRef.current += chunk;
              startTypewriter(assistantMessageId, convIdAtSendTime);
            } else {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convIdAtSendTime) return c;
                  const existingMsg = c.messages.find(
                    (m) => m.id === assistantMessageId,
                  );
                  if (existingMsg) {
                    return {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: m.content + chunk }
                          : m,
                      ),
                    };
                  }
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
                }),
              );
            }
          },
          (metadata) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            abortControllersRef.current.delete(convIdAtSendTime);
            const isForeground = currentConvIdRef.current === convIdAtSendTime;
            const finish = () => {
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convIdAtSendTime) return c;
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
                }),
              );
              if (isForeground) {
                setIsStreaming(false);
                setIsLoading(false);
              }
            };
            if (typewriterRunningRef.current && isForeground) {
              streamDoneRef.current = true;
              streamDoneCallbackRef.current = finish;
            } else {
              finish();
            }
          },
          (errorMsg: string) => {
            if (
              (streamGenerationsRef.current.get(convIdAtSendTime) || 0) !==
              myGen
            )
              return;
            abortControllersRef.current.delete(convIdAtSendTime);
            if (currentConvIdRef.current === convIdAtSendTime) {
              stopTypewriter();
            }
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convIdAtSendTime) return c;
                const existingMsg = c.messages.find(
                  (m) => m.id === assistantMessageId,
                );
                if (existingMsg) {
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, errorMessage: errorMsg }
                        : m,
                    ),
                  };
                }
                return {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: assistantMessageId,
                      role: "assistant" as const,
                      content: "",
                      timestamp: new Date(),
                      errorMessage: errorMsg,
                    },
                  ],
                  updatedAt: new Date(),
                };
              }),
            );
            if (currentConvIdRef.current === convIdAtSendTime) {
              setIsStreaming(false);
              setIsLoading(false);
            }
          },
          undefined,
          controller.signal,
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
          window.dispatchEvent(new CustomEvent("session-expired"));
        } else {
          setError(errMessage);
        }

        setConversations((prev) => {
          return prev.map((c) => {
            if (c.id !== currentConversationId) return c;
            return {
              ...c,
              messages: c.messages.filter(
                (m) => m.id !== userMessage.id && m.id !== assistantMessageId,
              ),
            };
          });
        });
        setIsStreaming(false);
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, isAuthenticated, currentConversation, effectiveAppId],
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

  // Directly append an assistant message without going through the LLM.
  // Used by the tool execution flow to display action results.
  const addAssistantMessage = useCallback(
    (content: string) => {
      const msgId = Math.random().toString(36).slice(2);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConversationId) return c;
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: msgId,
                role: "assistant" as const,
                content,
                timestamp: new Date(),
              },
            ],
            updatedAt: new Date(),
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
    user,
    fioriContext,

    login,
    logout,
    sendMessage,
    sendMessageWithFile,
    newConversation,
    deleteConversation,
    clearAll,
    renameConversation,
    togglePinConversation,
    stopGenerating,
    setCurrentConversationId,
    editMessage,
    regenerateLastResponse,
    reactToMessage,
    addAssistantMessage,
    execSteps,
  };
};

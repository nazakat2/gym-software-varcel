import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Minus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const QUICK_PROMPTS = [
  "Show what I can ask",
  "How do I add a new member?",
  "What reports can I download?",
  "Explain dashboard KPIs",
  "What does expiring soon mean?",
];

const STORAGE_KEY = "gym-ai-chat-history";
const MAX_HISTORY_FOR_API = 10;

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opening
  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, minimized]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setError(null);
    setInput("");

    const next: ChatMessage[] = [...messages, { role: "user", content: message, ts: Date.now() }];
    setMessages(next);
    setLoading(true);

    try {
      const history = next
        .slice(-MAX_HISTORY_FOR_API - 1, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Assistant unavailable");
      setMessages((m) => [...m, { role: "assistant", content: data.reply, ts: Date.now() }]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          aria-label="Open Gym AI Assistant"
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-2xl shadow-primary/30 px-4 py-3 transition-all hover:scale-105 hover:shadow-primary/50"
        >
          <div className="relative">
            <MessageCircle className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
          </div>
          <span className="text-sm font-semibold pr-1 hidden sm:inline">AI Assistant</span>
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 bg-card border shadow-2xl flex flex-col transition-all duration-300 ease-out",
            minimized
              ? "bottom-6 right-6 w-72 h-14 rounded-full"
              : "bottom-6 right-6 w-[380px] sm:w-[420px] h-[600px] max-h-[85vh] rounded-2xl"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground",
            minimized ? "rounded-full" : "rounded-t-2xl"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-primary"></span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-tight truncate">Gym AI Assistant</div>
                {!minimized && <div className="text-[11px] opacity-90 leading-tight">Online · Ready to help</div>}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {!minimized && messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setMinimized((m) => !m)}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors"
                aria-label={minimized ? "Expand" : "Minimize"}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setOpen(false); setMinimized(false); }}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-muted/20">
                {messages.length === 0 && (
                  <div className="space-y-3 py-2">
                    <div className="bg-card border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">Welcome!</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        I can help you navigate the gym admin panel, explain features, and answer operational questions.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-1">Try asking</p>
                      {QUICK_PROMPTS.map((p) => (
                        <button
                          key={p}
                          onClick={() => send(p)}
                          className="w-full text-left text-sm px-3 py-2 rounded-lg bg-card border hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border rounded-bl-sm"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive border border-destructive/20">
                      {error}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t p-3 bg-card rounded-b-2xl">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask about members, billing, reports..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60 max-h-24"
                  />
                  <Button
                    size="icon"
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="h-9 w-9 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  AI assistant · responses may need verification
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, X, Send, Loader2, Copy, Check, ChevronDown, FileText, Package,
  MessageSquare, Sparkles, Trash2, TrendingUp, Tag, Mail, Users,
  Zap, RotateCcw, CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────── */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  streaming?: boolean;
}

interface ExecuteResult {
  id: string;
  command: string;
  success: boolean;
  description: string;
  error?: string;
  undoInfo?: Record<string, unknown>;
  undone?: boolean;
  undoneDescription?: string;
}

type Tab = "chat" | "execute";

/* ── Chat presets ──────────────────────────────────── */
const PRESETS = [
  { icon: FileText, label: "Blog Post", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe",
    prompt: "Write a compelling SEO-optimized blog post (700+ words) for TryNex Lifestyle about custom printed t-shirts for Eid in Bangladesh. Include: an engaging intro, tips for choosing the right design, fabric quality (320 GSM), why custom apparel makes great Eid gifts, and a clear call-to-action. Add a meta description suggestion at the end." },
  { icon: Package, label: "Product Desc", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
    prompt: "Write 3 product description variants (short, medium, long) for our premium 320 GSM custom t-shirt. Highlight: DTG/screen print quality, AI design studio, upload-your-own artwork, 24-hour production, free delivery above ৳1,500, and delivery across all 64 districts." },
  { icon: MessageSquare, label: "Ad Copy", color: "#E85D04", bg: "#fff7ed", border: "#fed7aa",
    prompt: "Write 3 Facebook/Instagram ad copy variations for TryNex Lifestyle custom t-shirts targeting Bangladeshis aged 18-35. Include: a short hook (15 words), 2-3 benefit bullets, a CTA, and mention free delivery on orders over ৳1,500." },
  { icon: Sparkles, label: "Design Ideas", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
    prompt: "Give me 12 creative custom t-shirt & mug design ideas that will sell well in Bangladesh this season. Consider: Eid, cricket world cup, Bengali new year, retro Dhaka, hip-hop Bangla, couple sets." },
  { icon: TrendingUp, label: "Growth Plan", color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd",
    prompt: "Create a 30-day growth strategy for TryNex Lifestyle to increase sales by 40%. Include: daily social media schedule, Facebook group marketing, WhatsApp broadcast strategy, referral program tactics, and specific promo code strategies." },
  { icon: Tag, label: "Promo Strategy", color: "#d97706", bg: "#fffbeb", border: "#fde68a",
    prompt: "Design a complete promotional calendar for TryNex Lifestyle for the next 3 months covering Eid, Puja, Pohela Boishakh, and Valentine's Day. Include: discount %, promo code, minimum order, ad copy headline, and duration for each." },
  { icon: Mail, label: "Email Campaign", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe",
    prompt: "Write a 5-email welcome sequence for TryNex Lifestyle newsletter subscribers. Email 1: Welcome + 10% off code. Email 2: How the Design Studio works. Email 3: Customer success story. Email 4: Festival design inspiration. Email 5: Referral program intro." },
  { icon: Users, label: "Customer Reply", color: "#ef4444", bg: "#fef2f2", border: "#fecaca",
    prompt: "Write 5 professional customer service response templates in English AND Bangla for: (1) delayed order, (2) design revision, (3) refund inquiry, (4) quality complaint, (5) post-delivery thank you." },
];

/* ── Execute command examples ──────────────────────── */
const COMMAND_EXAMPLES = [
  { label: "List products", example: "List all products" },
  { label: "Search products", example: "Search products for hoodie" },
  { label: "Create product", example: "Create a product called 'Eid Special Hoodie' priced at ৳1499 in the Hoodies category" },
  { label: "Delete product", example: "Delete product named 'Old Test Product'" },
  { label: "Update price", example: "Update price of 'Custom Mug' to ৳699" },
  { label: "Update stock", example: "Set stock of 'Classic White Tee' to 150" },
  { label: "Update description", example: "Update description of 'Custom Mug' to: Premium 11oz ceramic mug with vibrant sublimation printing. Perfect for gifts." },
  { label: "Update order", example: "Update order #145 to shipped" },
  { label: "Find order", example: "Find order by customer Rahim" },
  { label: "Add promo code", example: "Create promo code EID25 for 25% off, min order ৳1000" },
  { label: "Delete promo", example: "Delete promo code OLDCODE" },
  { label: "Feature product", example: "Feature the product named 'Custom T-Shirt'" },
  { label: "SEO advice", example: "How do I get TryNex to rank on Google?" },
  { label: "Keyword tips", example: "What keywords should I target for ranking?" },
];

const TEXT_MODELS = [
  { id: "openai-large", label: "GPT-4o (Best)" },
  { id: "openai", label: "GPT-4o Mini" },
  { id: "mistral-large", label: "Mistral Large" },
  { id: "llama", label: "Llama 3.3" },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

/* ── Markdown-ish formatter ────────────────────────── */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="font-black text-sm mt-2 mb-0.5">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-[13px] mt-1.5 mb-0.5">{line.slice(4)}</p>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        if (line.startsWith("• ") || line.startsWith("- ")) return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-current opacity-50 inline-block" />
            <span>{line.slice(2)}</span>
          </div>
        );
        if (/^\d+\. /.test(line)) return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 font-bold opacity-60 text-[11px] mt-0.5">{line.match(/^(\d+)\./)?.[1]}.</span>
            <span>{line.replace(/^\d+\. /, "")}</span>
          </div>
        );
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        const bolded = line.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${t}</strong>`);
        return <p key={i} dangerouslySetInnerHTML={{ __html: bolded }} />;
      })}
    </div>
  );
}

/* ── Streaming dots indicator ──────────────────────── */
function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1 align-middle">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-purple-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }} />
      ))}
    </span>
  );
}

/* ════════════════════════════════════════════════════
   Main Component
════════════════════════════════════════════════════ */
export function AdminAIAssistant() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  /* Chat state */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [model, setModel] = useState("openai-large");
  const [copied, setCopied] = useState<number | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [activeModelLabel, setActiveModelLabel] = useState<string | null>(null);

  /* Execute state */
  const [cmdInput, setCmdInput] = useState("");
  const [cmdLoading, setCmdLoading] = useState(false);
  const [execResults, setExecResults] = useState<ExecuteResult[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const cmdInputRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Init chat greeting */
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI assistant for TryNex. I stream responses in real-time so you see results instantly. Switch to **Execute** to run store commands like creating products, updating orders, or managing promo codes.",
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, execResults]);

  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModelPicker]);

  /* ── Streaming chat send ────────────────────────── */
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading) return;
    setChatInput("");

    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatLoading(true);
    setActiveModelLabel(null);

    const assistantMsgId = uid();
    const streamingPlaceholder: ChatMessage = { role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, streamingPlaceholder]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(getApiUrl("/api/ai/chat"), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          messages: nextMessages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(payload) as { type: string; delta?: string; model?: string; error?: string };
            if (parsed.type === "model" && parsed.model) {
              const label = TEXT_MODELS.find(m => m.id === parsed.model)?.label ?? parsed.model;
              setActiveModelLabel(label);
            } else if (parsed.type === "delta" && parsed.delta) {
              accumulated += parsed.delta;
              const snap = accumulated;
              setMessages(prev => prev.map((m, idx) =>
                idx === prev.length - 1 && m.streaming
                  ? { ...m, content: snap }
                  : m
              ));
            } else if (parsed.type === "done") {
              break;
            } else if (parsed.type === "error") {
              throw new Error(parsed.error || "Stream error");
            }
          } catch { /* non-JSON */ }
        }
      }

      setMessages(prev => prev.map((m, idx) =>
        idx === prev.length - 1 && m.streaming
          ? { ...m, content: accumulated || m.content, streaming: false }
          : m
      ));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || `Sorry, I hit an error: ${msg}. Please try again.`,
            streaming: false,
            error: !last.content,
          };
        } else {
          updated.push({ role: "assistant", content: `Sorry, I hit an error: ${msg}. Please try again.`, error: true });
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
      setActiveModelLabel(null);
      void assistantMsgId;
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }, [chatInput, chatLoading, messages, model]);

  /* ── Execute command ──────────────────────────── */
  const executeCommand = useCallback(async (cmd?: string) => {
    const command = (cmd ?? cmdInput).trim();
    if (!command || cmdLoading) return;
    setCmdInput("");
    setCmdLoading(true);

    const resultId = uid();
    setExecResults(prev => [{
      id: resultId,
      command,
      success: false,
      description: "Processing…",
    }, ...prev]);

    try {
      const res = await fetch(getApiUrl("/api/admin/ai-execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ command }),
      });
      const data = await res.json() as {
        success?: boolean;
        description?: string;
        error?: string;
        details?: string;
        suggestions?: string[];
        undoInfo?: Record<string, unknown>;
      };

      if (!res.ok || !data.success) {
        const errMsg = data.error || "Execution failed";
        const details = data.details ? ` — ${data.details}` : "";
        const hints = data.suggestions ? `\n\nTry:\n${data.suggestions.map(s => `• ${s}`).join("\n")}` : "";
        setExecResults(prev => prev.map(r => r.id === resultId
          ? { ...r, success: false, description: errMsg + details + hints, error: errMsg }
          : r
        ));
      } else {
        setExecResults(prev => prev.map(r => r.id === resultId
          ? { ...r, success: true, description: data.description || "Done", undoInfo: data.undoInfo }
          : r
        ));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setExecResults(prev => prev.map(r => r.id === resultId
        ? { ...r, success: false, description: msg, error: msg }
        : r
      ));
    } finally {
      setCmdLoading(false);
      setTimeout(() => cmdInputRef.current?.focus(), 50);
    }
  }, [cmdInput, cmdLoading]);

  /* ── Undo action ────────────────────────────── */
  const undoAction = useCallback(async (result: ExecuteResult) => {
    if (!result.undoInfo || result.undone) return;
    setUndoingId(result.id);
    try {
      const res = await fetch(getApiUrl("/api/admin/ai-undo"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ undoInfo: result.undoInfo }),
      });
      const data = await res.json() as { success?: boolean; description?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || "Undo failed");
      setExecResults(prev => prev.map(r => r.id === result.id
        ? { ...r, undone: true, undoneDescription: data.description }
        : r
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Undo failed";
      setExecResults(prev => prev.map(r => r.id === result.id
        ? { ...r, error: msg }
        : r
      ));
    } finally {
      setUndoingId(null);
    }
  }, []);

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([{ role: "assistant", content: "Chat cleared! What would you like to create?" }]);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setChatLoading(false);
    setMessages(prev => prev.map((m, idx) =>
      idx === prev.length - 1 && m.streaming ? { ...m, streaming: false } : m
    ));
  };

  const currentModelLabel = TEXT_MODELS.find(m => m.id === model)?.label ?? "GPT-4o";

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl"
        style={{
          background: open ? "#374151" : "linear-gradient(135deg,#7c3aed,#a855f7)",
          boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
        }}
        title="AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="w-5 h-5" /></motion.div>
            : <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Bot className="w-6 h-6" /></motion.div>
          }
        </AnimatePresence>
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
            style={{ background: "#E85D04" }}>AI</span>
        )}
      </motion.button>

      {/* Chat / Execute panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-24 right-6 z-50 w-[440px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl overflow-hidden"
            style={{
              height: "min(640px, calc(100vh - 140px))",
              background: "white",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-none">TryNex AI Assistant</p>
                <p className="text-[10px] text-purple-200 mt-0.5">
                  {chatLoading && activeModelLabel
                    ? `Streaming via ${activeModelLabel}…`
                    : "Free · Streaming · Real-time responses"}
                </p>
              </div>
              {/* Tab toggle */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/15">
                <button
                  onClick={() => setTab("chat")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: tab === "chat" ? "white" : "transparent", color: tab === "chat" ? "#7c3aed" : "rgba(255,255,255,0.8)" }}
                >
                  <MessageSquare className="w-3 h-3" /> Chat
                </button>
                <button
                  onClick={() => setTab("execute")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: tab === "execute" ? "white" : "transparent", color: tab === "execute" ? "#7c3aed" : "rgba(255,255,255,0.8)" }}
                >
                  <Zap className="w-3 h-3" /> Execute
                </button>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1">
                {tab === "chat" && (
                  <>
                    {chatLoading && (
                      <button onClick={stopStreaming} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors" title="Stop streaming">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={clearChat} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors" title="Clear chat">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative" ref={modelPickerRef}>
                      <button
                        onClick={() => setShowModelPicker(p => !p)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white/90 hover:bg-white/20 transition-colors"
                      >
                        {currentModelLabel} <ChevronDown className="w-3 h-3" />
                      </button>
                      {showModelPicker && (
                        <div className="absolute right-0 top-8 w-44 rounded-xl overflow-hidden z-10 shadow-xl"
                          style={{ background: "white", border: "1px solid #e5e7eb" }}>
                          {TEXT_MODELS.map(m => (
                            <button key={m.id} onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                              className="w-full px-3 py-2 text-left text-xs font-semibold transition-colors"
                              style={{ background: model === m.id ? "#f5f3ff" : "white", color: model === m.id ? "#7c3aed" : "#374151" }}>
                              {m.label}{model === m.id && <span className="ml-1 text-[9px]">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {tab === "execute" && execResults.length > 0 && (
                  <button onClick={() => setExecResults([])} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors" title="Clear history">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── CHAT TAB ──────────────────────────────── */}
            {tab === "chat" && (
              <>
                {/* Quick presets */}
                {messages.length <= 1 && (
                  <div className="p-3 border-b border-gray-100 shrink-0" style={{ maxHeight: 160, overflowY: "auto" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Quick actions</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESETS.map(p => {
                        const Icon = p.icon;
                        return (
                          <button key={p.label} onClick={() => sendMessage(p.prompt)} disabled={chatLoading}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-50"
                            style={{ background: p.bg, border: `1.5px solid ${p.border}` }}>
                            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: p.color }} />
                            <span className="text-[11px] font-bold" style={{ color: p.color }}>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[88%] relative group">
                        <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                          style={
                            msg.role === "user"
                              ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white", borderBottomRightRadius: 4 }
                              : msg.error
                                ? { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderBottomLeftRadius: 4 }
                                : { background: "#f9fafb", color: "#111827", border: "1px solid #f3f4f6", borderBottomLeftRadius: 4 }
                          }>
                          {msg.content ? <FormattedMessage content={msg.content} /> : null}
                          {msg.streaming && <StreamingDots />}
                        </div>
                        {msg.role === "assistant" && !msg.error && !msg.streaming && msg.content && (
                          <button onClick={() => copyMessage(msg.content, idx)}
                            className="absolute -top-1 -right-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "white", border: "1px solid #e5e7eb", color: copied === idx ? "#059669" : "#6b7280" }}
                            title="Copy">
                            {copied === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-100 shrink-0">
                  <div className="flex items-end gap-2 p-2 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <textarea
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Ask me to write blog posts, product descriptions, ad copy…"
                      rows={2}
                      className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400"
                      style={{ maxHeight: 120 }}
                    />
                    <button onClick={() => chatLoading ? stopStreaming() : sendMessage()} disabled={!chatLoading && !chatInput.trim()}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 shrink-0"
                      style={{ background: chatLoading ? "#ef4444" : "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                      title={chatLoading ? "Stop" : "Send"}>
                      {chatLoading
                        ? <X className="w-3.5 h-3.5" />
                        : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">TryNex AI · Streams in real-time · Powered by Pollinations</p>
                </div>
              </>
            )}

            {/* ── EXECUTE TAB ───────────────────────────── */}
            {tab === "execute" && (
              <>
                {/* Command examples */}
                {execResults.length === 0 && (
                  <div className="p-3 border-b border-gray-100 shrink-0" style={{ maxHeight: 220, overflowY: "auto" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Example commands</p>
                    <div className="space-y-1">
                      {COMMAND_EXAMPLES.slice(0, 8).map(ex => (
                        <button key={ex.label} onClick={() => executeCommand(ex.example)} disabled={cmdLoading}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all hover:bg-purple-50 disabled:opacity-50 group"
                          style={{ border: "1px solid #f3f4f6" }}>
                          <div>
                            <p className="text-[11px] font-bold text-gray-700">{ex.label}</p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[280px]">{ex.example}</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-purple-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results */}
                {execResults.length > 0 && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {execResults.map(r => (
                      <motion.div key={r.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-3"
                        style={{
                          background: r.description === "Processing…"
                            ? "#fafafa"
                            : r.success
                              ? r.undone ? "#f0fdf4" : "#f5f3ff"
                              : "#fef2f2",
                          border: `1px solid ${r.description === "Processing…" ? "#e5e7eb" : r.success ? r.undone ? "#bbf7d0" : "#ddd6fe" : "#fecaca"}`,
                        }}>
                        <div className="flex items-start gap-2">
                          {r.description === "Processing…"
                            ? <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0 mt-0.5" />
                            : r.success
                              ? <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${r.undone ? "text-green-500" : "text-purple-500"}`} />
                              : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 truncate">{r.command}</p>
                            <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{r.undone ? r.undoneDescription || "Undone" : r.description}</p>
                          </div>
                        </div>
                        {r.success && !r.undone && r.undoInfo && (
                          <button
                            onClick={() => undoAction(r)}
                            disabled={!!undoingId}
                            className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:bg-white disabled:opacity-50"
                            style={{ color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                            {undoingId === r.id
                              ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Undoing…</>
                              : <><RotateCcw className="w-2.5 h-2.5" /> Undo</>}
                          </button>
                        )}
                      </motion.div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}

                {execResults.length === 0 && <div className="flex-1" />}

                {/* Input */}
                <div className="p-3 border-t border-gray-100 shrink-0">
                  <div className="flex items-end gap-2 p-2 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <textarea
                      ref={cmdInputRef}
                      value={cmdInput}
                      onChange={e => setCmdInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeCommand(); } }}
                      placeholder="Type a command in plain language…"
                      rows={2}
                      className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400"
                      style={{ maxHeight: 100 }}
                    />
                    <button onClick={() => executeCommand()} disabled={!cmdInput.trim() || cmdLoading}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {cmdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">Commands are executed against your live store database</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

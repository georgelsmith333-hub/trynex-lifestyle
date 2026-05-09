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
  { label: "Create product", example: "Create a product called 'Eid Special Hoodie' priced at ৳1499 in the Hoodies category" },
  { label: "Update order", example: "Update order #145 to shipped" },
  { label: "Add promo code", example: "Create promo code EID25 for 25% off, min order ৳1000" },
  { label: "Feature product", example: "Feature the product named 'Custom T-Shirt'" },
  { label: "Change price", example: "Update price of 'Custom Mug' to ৳699" },
  { label: "Delete promo", example: "Delete promo code OLDCODE" },
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

  /* Execute state */
  const [cmdInput, setCmdInput] = useState("");
  const [cmdLoading, setCmdLoading] = useState(false);
  const [execResults, setExecResults] = useState<ExecuteResult[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const cmdInputRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  /* Init chat greeting */
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI assistant for TryNex. Switch to the **Execute** tab to run commands like creating products, updating orders, or managing promo codes. Or chat here to generate content!",
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

  /* ── Chat send ──────────────────────────────────── */
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/ai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: nextMessages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "AI error");
      setMessages(prev => [...prev, { role: "assistant", content: data.content! }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I hit an error: ${msg}. Please try again.`, error: true }]);
    } finally {
      setChatLoading(false);
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
    setMessages([{ role: "assistant", content: "Chat cleared! What would you like to create?" }]);
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
            className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl overflow-hidden"
            style={{
              height: "min(600px, calc(100vh - 140px))",
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
                <p className="text-sm font-black text-white leading-none">AI Assistant</p>
                <p className="text-[10px] text-purple-200 mt-0.5">Free · Unlimited · No API key</p>
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
                      <div className="max-w-[85%] relative group">
                        <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                          style={
                            msg.role === "user"
                              ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white", borderBottomRightRadius: 4 }
                              : msg.error
                                ? { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderBottomLeftRadius: 4 }
                                : { background: "#f9fafb", color: "#111827", border: "1px solid #f3f4f6", borderBottomLeftRadius: 4 }
                          }>
                          <FormattedMessage content={msg.content} />
                        </div>
                        {msg.role === "assistant" && !msg.error && (
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
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-sm"
                        style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
                              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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
                    <button onClick={() => sendMessage()} disabled={!chatInput.trim() || chatLoading}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">Powered by Pollinations AI · Free & unlimited</p>
                </div>
              </>
            )}

            {/* ── EXECUTE TAB ───────────────────────────── */}
            {tab === "execute" && (
              <>
                {/* Command examples (shown when history is empty) */}
                {execResults.length === 0 && (
                  <div className="p-3 border-b border-gray-100 shrink-0" style={{ maxHeight: 220, overflowY: "auto" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Example commands</p>
                    <div className="space-y-1.5">
                      {COMMAND_EXAMPLES.map(ex => (
                        <button key={ex.label} onClick={() => setCmdInput(ex.example)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all hover:scale-[1.01]"
                          style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe" }}>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                          <div>
                            <p className="text-[10px] font-black text-purple-700">{ex.label}</p>
                            <p className="text-[10px] text-purple-500 leading-tight">{ex.example}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution history */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {execResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg,#f5f3ff,#ede9fe)" }}>
                        <Zap className="w-6 h-6 text-purple-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">AI Command Executor</p>
                      <p className="text-xs text-gray-400 max-w-[260px]">Type a command below and the AI will understand it, execute it, and let you undo if needed.</p>
                    </div>
                  )}
                  {execResults.map(result => (
                    <div key={result.id} className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${result.undone ? "#d1fae5" : result.success ? "#e9d5ff" : result.error ? "#fecaca" : "#e5e7eb"}` }}>
                      {/* Command label */}
                      <div className="px-3 py-2" style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Command</p>
                        <p className="text-xs text-gray-700 font-medium leading-snug">{result.command}</p>
                      </div>
                      {/* Result */}
                      <div className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          {result.undone
                            ? <RotateCcw className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-500" />
                            : result.success
                              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-500" />
                              : result.description === "Processing…"
                                ? <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400 animate-spin" />
                                : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                          }
                          <p className="text-xs leading-snug flex-1"
                            style={{ color: result.undone ? "#065f46" : result.success ? "#4c1d95" : result.description === "Processing…" ? "#9ca3af" : "#991b1b", whiteSpace: "pre-line" }}>
                            {result.undone ? (result.undoneDescription ?? "Undone") : result.description}
                          </p>
                        </div>
                        {/* Undo button */}
                        {result.success && !result.undone && result.undoInfo && (
                          <button onClick={() => undoAction(result)} disabled={undoingId === result.id}
                            className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                            style={{ background: "#faf5ff", border: "1.5px solid #e9d5ff", color: "#7c3aed" }}>
                            {undoingId === result.id
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Undoing…</>
                              : <><RotateCcw className="w-3 h-3" /> Undo this</>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Command input */}
                <div className="p-3 border-t border-gray-100 shrink-0">
                  <div className="flex items-end gap-2 p-2 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <textarea
                      ref={cmdInputRef}
                      value={cmdInput}
                      onChange={e => setCmdInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeCommand(); } }}
                      placeholder='e.g. "Update order #145 to shipped"'
                      rows={2}
                      disabled={cmdLoading}
                      className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50"
                      style={{ maxHeight: 120 }}
                    />
                    <button onClick={() => executeCommand()} disabled={!cmdInput.trim() || cmdLoading}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {cmdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">AI parses & executes · All actions are logged · Undo available</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}

/* ── Markdown-ish formatter ────────────────────── */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="font-black text-sm mt-2">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="font-black text-base mt-2">{line.slice(2)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-sm mt-1.5">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <p key={i} className="flex gap-1.5"><span className="mt-1 shrink-0">•</span><span>{formatInline(line.slice(2))}</span></p>;
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return <p key={i} className="flex gap-1.5"><span className="font-bold shrink-0">{num}.</span><span>{formatInline(line.replace(/^\d+\. /, ""))}</span></p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: "rgba(0,0,0,0.08)" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

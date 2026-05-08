import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Loader2, Copy, Check, ChevronDown, FileText, Package, MessageSquare, Sparkles, Trash2, TrendingUp, Tag, Mail, Users } from "lucide-react";
import { getApiUrl } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const PRESETS = [
  {
    icon: FileText,
    label: "Blog Post",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    prompt: "Write a compelling SEO-optimized blog post (700+ words) for TryNex Lifestyle about custom printed t-shirts for Eid in Bangladesh. Include: an engaging intro, tips for choosing the right design, fabric quality (320 GSM), why custom apparel makes great Eid gifts, and a clear call-to-action. Add a meta description suggestion at the end.",
  },
  {
    icon: Package,
    label: "Product Description",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    prompt: "Write 3 product description variants (short, medium, long) for our premium 320 GSM custom t-shirt. Highlight: DTG/screen print quality, AI design studio, upload-your-own artwork, 24-hour production, free delivery above ৳1,500, and delivery across all 64 districts. Make each variant sound premium yet approachable for young Bangladeshis.",
  },
  {
    icon: MessageSquare,
    label: "Ad Copy",
    color: "#E85D04",
    bg: "#fff7ed",
    border: "#fed7aa",
    prompt: "Write 3 Facebook/Instagram ad copy variations for TryNex Lifestyle custom t-shirts targeting Bangladeshis aged 18-35. Include: a short hook (15 words), 2-3 benefit bullets, a CTA, and mention free delivery on orders over ৳1,500. Make one playful, one aspirational, and one urgency-focused (limited offer).",
  },
  {
    icon: Sparkles,
    label: "Design Ideas",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    prompt: "Give me 12 creative custom t-shirt & mug design ideas that will sell well in Bangladesh this season. Consider: Eid, Durga Puja, cricket world cup, Bengali new year (Pohela Boishakh), retro Dhaka, hip-hop Bangla, couple sets. For each: name, description, color palette suggestion, and target audience.",
  },
  {
    icon: TrendingUp,
    label: "Growth Strategy",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    border: "#bae6fd",
    prompt: "Create a 30-day growth strategy for TryNex Lifestyle to increase sales by 40%. Include: daily social media posting schedule, Facebook group marketing, WhatsApp broadcast strategy, referral program tactics, influencer collaboration ideas for Bangladesh, and specific promo code strategies for different customer segments.",
  },
  {
    icon: Tag,
    label: "Promo Strategy",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    prompt: "Design a complete promotional calendar for TryNex Lifestyle for the next 3 months covering major Bangladeshi festivals and shopping occasions. For each promo: discount percentage, promo code, minimum order, target audience, ad copy headline, and duration. Include Eid, Puja, 21st February, Pohela Boishakh, and Valentine's Day.",
  },
  {
    icon: Mail,
    label: "Email Campaign",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    prompt: "Write a 5-email welcome sequence for TryNex Lifestyle newsletter subscribers. Email 1: Welcome + 10% off code. Email 2: How the Design Studio works. Email 3: Customer success story. Email 4: Design inspiration for next festival. Email 5: Referral program intro. Keep each under 200 words, warm and Bangladeshi-friendly tone.",
  },
  {
    icon: Users,
    label: "Customer Reply",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    prompt: "Write 5 professional yet warm customer service response templates in English AND Bangla for: (1) delayed order apology, (2) design revision request, (3) refund/return inquiry, (4) product quality complaint, (5) thank you after delivery. Make them sound human and brand-consistent with TryNex's premium but accessible tone.",
  },
];

const TEXT_MODELS = [
  { id: "openai-large",  label: "GPT-4o (Best)" },
  { id: "openai",        label: "GPT-4o Mini" },
  { id: "mistral-large", label: "Mistral Large" },
  { id: "llama",         label: "Llama 3.3" },
];

export function AdminAIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("openai-large");
  const [copied, setCopied] = useState<number | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI assistant for TryNex. I can help you write blog posts, product descriptions, ad copy, email campaigns, design ideas, and answer any business questions. What would you like to create today?",
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/ai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: nextMessages.filter(m => !m.error).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "AI error");
      setMessages(prev => [...prev, { role: "assistant", content: data.content! }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I hit an error: ${msg}. Please try again.`, error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages, model]);

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Chat cleared! What would you like to create?",
    }]);
  };

  const currentModelLabel = TEXT_MODELS.find(m => m.id === model)?.label ?? "GPT-4o";

  return (
    <>
      {/* Floating toggle button */}
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

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl overflow-hidden"
            style={{
              height: "min(560px, calc(100vh - 140px))",
              background: "white",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-none">AI Assistant</p>
                <p className="text-[10px] text-purple-200 mt-0.5">Free · Unlimited · No API key</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {/* Model selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(p => !p)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white/90 hover:bg-white/20 transition-colors"
                  >
                    {currentModelLabel}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModelPicker && (
                    <div
                      className="absolute right-0 top-8 w-44 rounded-xl overflow-hidden z-10 shadow-xl"
                      style={{ background: "white", border: "1px solid #e5e7eb" }}
                    >
                      {TEXT_MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold transition-colors"
                          style={{
                            background: model === m.id ? "#f5f3ff" : "white",
                            color: model === m.id ? "#7c3aed" : "#374151",
                          }}
                        >
                          {m.label}
                          {model === m.id && <span className="ml-1 text-[9px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick presets */}
            {messages.length <= 1 && (
              <div className="p-3 border-b border-gray-100 shrink-0" style={{ maxHeight: 180, overflowY: "auto" }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Quick actions</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map(p => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.label}
                        onClick={() => sendMessage(p.prompt)}
                        disabled={loading}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{ background: p.bg, border: `1.5px solid ${p.border}` }}
                      >
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
                  <div
                    className="max-w-[85%] relative group"
                  >
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                      style={
                        msg.role === "user"
                          ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white", borderBottomRightRadius: 4 }
                          : msg.error
                          ? { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderBottomLeftRadius: 4 }
                          : { background: "#f9fafb", color: "#111827", border: "1px solid #f3f4f6", borderBottomLeftRadius: 4 }
                      }
                    >
                      <FormattedMessage content={msg.content} />
                    </div>
                    {msg.role === "assistant" && !msg.error && (
                      <button
                        onClick={() => copyMessage(msg.content, idx)}
                        className="absolute -top-1 -right-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "white", border: "1px solid #e5e7eb", color: copied === idx ? "#059669" : "#6b7280" }}
                        title="Copy"
                      >
                        {copied === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
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
              <div className="flex items-end gap-2 p-2 rounded-xl"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="Ask me to write blog posts, product descriptions, ad copy…"
                  rows={2}
                  className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400"
                  style={{ maxHeight: 120 }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 shrink-0"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[9px] text-gray-400 text-center mt-1.5">
                Powered by Pollinations AI · Free & unlimited · No data stored
              </p>
            </div>
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

/* Formats markdown-ish content — headings, bold, code blocks, lists */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="font-black text-sm mt-2">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="font-black text-base mt-2">{line.slice(2)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="font-bold text-sm mt-1.5">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="flex gap-1.5"><span className="mt-1 shrink-0">•</span><span>{formatInline(line.slice(2))}</span></p>;
        }
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
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: "rgba(0,0,0,0.08)" }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

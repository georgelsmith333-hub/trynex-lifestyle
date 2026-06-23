import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";
import { MessageSquare, RefreshCw, Send, UserCircle } from "lucide-react";

interface Conversation {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number | string;
}

interface SupportMessage {
  id: number;
  customer_id: number;
  sender_type: "admin" | "customer";
  sender_name?: string;
  message: string;
  created_at: string;
}

export default function AdminMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/messages/conversations"), { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      setConversations(data.conversations ?? []);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (customerId: number) => {
    const res = await fetch(getApiUrl(`/api/admin/messages/customers/${customerId}`), { headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    setMessages(data.messages ?? []);
    void loadConversations();
  };

  useEffect(() => { void loadConversations(); }, []);
  useEffect(() => { if (selected) void loadMessages(selected.customer_id); }, [selected?.customer_id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/messages/customers/${selected.customer_id}`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: draft.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setDraft("");
        void loadConversations();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-orange-500" /> Direct Messages
            </h1>
            <p className="text-sm text-gray-500">Customer support chat from account profile messages.</p>
          </div>
          <button onClick={loadConversations} className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
          <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 font-black text-xs uppercase tracking-widest text-gray-500">
              Conversations
            </div>
            <div className="overflow-y-auto flex-1">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No direct messages yet.</div>
              ) : conversations.map(c => {
                const active = selected?.customer_id === c.customer_id;
                const unread = Number(c.unread_count ?? 0);
                return (
                  <button key={c.customer_id} onClick={() => setSelected(c)} className={`w-full text-left p-4 border-b border-gray-50 hover:bg-orange-50/50 ${active ? "bg-orange-50" : "bg-white"}`}>
                    <div className="flex items-start gap-3">
                      <UserCircle className="w-9 h-9 text-gray-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-gray-900 truncate">{c.customer_name}</p>
                          {unread > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black">{unread}</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{c.customer_email}</p>
                        <p className="text-xs text-gray-500 truncate mt-1">{c.last_message}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-0 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-black text-gray-900">{selected.customer_name}</p>
                  <p className="text-xs text-gray-500">{selected.customer_email}{selected.customer_phone ? ` • ${selected.customer_phone}` : ""}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/60">
                  {messages.map(m => {
                    const mine = m.sender_type === "admin";
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-orange-500 text-white" : "bg-white border border-gray-100 text-gray-900"}`}>
                          {!mine && <p className="text-[10px] font-bold opacity-60 mb-0.5">{m.sender_name || "Customer"}</p>}
                          <p className="whitespace-pre-line leading-relaxed">{m.message}</p>
                          <p className="text-[10px] opacity-60 mt-1 text-right">{new Date(m.created_at).toLocaleString("en-BD")}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <form onSubmit={e => { e.preventDefault(); void send(); }} className="p-3 border-t border-gray-100 flex gap-2">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} maxLength={2000} placeholder="Reply to customer…" className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  <button disabled={sending || !draft.trim()} className="px-4 rounded-xl bg-orange-500 text-white font-black disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
                <MessageSquare className="w-12 h-12 mb-3 text-gray-200" />
                <p className="font-bold text-gray-600">Select a customer conversation</p>
                <p className="text-sm">Direct account messages will appear here.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

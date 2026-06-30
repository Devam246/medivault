import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, AlertCircle } from "lucide-react";
import { API_BASE } from "../../api/patientApi";
import CANNED_RESPONSES from "../../../../rag-service/canned_responses.json";


function normalizeQuery(text) {
  return text?.trim().toLowerCase().replace(/[?!.]+$/, "");
}

export default function PatientHealthChat({ token }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask questions about your MediVault history (records, appointments, prescriptions, vitals). Answers use retrieved excerpts from your data only — not a medical diagnosis.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(e) {
    e?.preventDefault();
    await sendQuery(input.trim());
  }

  async function sendQuery(text) {
    if (!text || sending) return;

    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);

    const normalized = normalizeQuery(text);
    const canned = CANNED_RESPONSES[normalized];
    if (canned) {
      setMessages((m) => [...m, { role: "assistant", content: canned }]);
      setSending(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/patient/rag/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text, top_k: 5 }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed (${res.status})`);
      }

      const answer = data.answer || data.message || "No answer returned.";
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry, I could not complete that request. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col min-h-[520px] max-h-[70vh]">
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-cyan-50">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-sky-600" />
          Health Assistant
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          RAG over your chart in MediVault (Groq). For information only — consult your clinician for medical decisions.
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-sky-500 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 flex items-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Retrieving context and generating answer…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-slate-100 bg-slate-50/80">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. What medications am I currently prescribed?"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            disabled={sending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-xl bg-sky-500 text-white px-5 py-3 font-medium hover:bg-sky-600 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

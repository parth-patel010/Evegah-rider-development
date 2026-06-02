import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  MessageSquare,
  Minimize2,
  Send,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Open/close via custom event so any component (e.g. EmployeeSidebar) can
// trigger the floating chatbot without prop drilling.
// ---------------------------------------------------------------------------

const OPEN_EVENT = "evegah:open-chatbot";

export function openChatbot() {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Canned routing / quick replies — keeps this useful without a real LLM yet.
// ---------------------------------------------------------------------------

const QUICK_PROMPTS = [
  { label: "Onboard a new rider", route: "/employee/new-rider" },
  { label: "Return a ride", route: "/employee/return-vehicle" },
  { label: "Extend a ride", route: "/employee/extend-ride" },
  { label: "Battery swap", route: "/employee/battery-swap" },
];

const KEYWORD_REPLIES = [
  {
    match: /\b(new|onboard|register)\b/i,
    reply: "Head to **Create Request → New Rider** to onboard a rider. The wizard walks you through KYC, rental details, agreement, documents, and payment.",
    cta: { label: "Open New Rider", route: "/employee/new-rider" },
  },
  {
    match: /\b(return|complete\s+ride|close\s+ride)\b/i,
    reply: "Use **Ride Operations → Return Rider** to close an active ride. You'll inspect the vehicle, settle charges, and issue a refund if needed.",
    cta: { label: "Open Return Rider", route: "/employee/return-vehicle" },
  },
  {
    match: /\b(extend|extra\s+day|more\s+days)\b/i,
    reply: "**Ride Operations → Extend Ride** lets you push the return date and collect any extra charges via UPI or cash.",
    cta: { label: "Open Extend Ride", route: "/employee/extend-ride" },
  },
  {
    match: /\b(retain|continue|renew)\b/i,
    reply: "**Ride Operations → Retain Rider** is for an existing rider starting a new ride before the current one expires.",
    cta: { label: "Open Retain Rider", route: "/employee/retain-rider" },
  },
  {
    match: /\b(battery|swap|cell)\b/i,
    reply: "Open **Battery Swap** to record an old → new battery for an active rental. Optional UPI payment is supported.",
    cta: { label: "Open Battery Swap", route: "/employee/battery-swap" },
  },
  {
    match: /\b(exchange|swap\s+vehicle|change\s+bike)\b/i,
    reply: "**Ride Operations → Exchange Vehicle** lets you swap the vehicle on an active rental without closing the ride.",
    cta: { label: "Open Exchange Vehicle", route: "/employee/exchange-vehicle" },
  },
  {
    match: /\b(payment|upi|icici|qr|refund)\b/i,
    reply: "Payments use ICICI UPI. Generate a QR from any ride flow's payment step. Once the bank returns SUCCESS, the action is unlocked.",
  },
  {
    match: /\b(password|login|account|reset)\b/i,
    reply: "Default employee login is `user@gmail.com` / `user@123`. Change it from **Profile → Account**.",
    cta: { label: "Open Profile", route: "/employee/profile" },
  },
  {
    match: /\b(help|support|ticket)\b/i,
    reply: "If you're stuck, raise a ticket and the ops team will reach out.",
    cta: { label: "Raise a Ticket", route: "/employee/support" },
  },
];

const DEFAULT_REPLY =
  "I'm still learning! Try asking about onboarding a rider, returning a ride, extending a ride, battery swap, or payments. You can also tap one of the suggestions below.";

function replyFor(text) {
  const hit = KEYWORD_REPLIES.find((rule) => rule.match.test(text));
  if (hit) return { reply: hit.reply, cta: hit.cta || null };
  return { reply: DEFAULT_REPLY, cta: null };
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer: only handles **bold** and `code`. Good enough for
// the canned replies and avoids pulling in a markdown lib.
// ---------------------------------------------------------------------------

function renderInline(text) {
  const tokens = String(text || "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((t, i) => {
    if (/^\*\*[^*]+\*\*$/.test(t)) {
      return (
        <strong key={i} className="font-semibold">
          {t.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(t)) {
      return (
        <code key={i} className="rounded bg-black/5 px-1 py-0.5 text-[11px] font-mono">
          {t.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{t}</span>;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const greetingMessage = {
  id: "greet",
  role: "bot",
  text:
    "Hi! I'm **Eve**, your eVEGAH assistant. I can help you find the right page, explain how flows work, or jog your memory about a feature. What do you need?",
};

export default function Chatbot() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([greetingMessage]);
  const [typing, setTyping] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Listen for external open requests (e.g. from the sidebar card).
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setMinimized(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Scroll to bottom whenever messages change.
  useEffect(() => {
    if (!open || minimized) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open, minimized]);

  const sendMessage = (raw, ctaToFollow = null) => {
    const text = String(raw || "").trim();
    if (!text) return;
    const userMsg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTyping(true);
    const delay = 350 + Math.min(text.length * 12, 800);
    window.setTimeout(() => {
      const { reply, cta } = replyFor(text);
      const finalCta = ctaToFollow || cta;
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: reply,
          cta: finalCta || null,
        },
      ]);
      setTyping(false);
    }, delay);
  };

  const handleQuickPrompt = (prompt) => {
    sendMessage(prompt.label, { label: `Open ${prompt.label.split(" ").slice(-2).join(" ")}`, route: prompt.route });
  };

  const handleCta = (route) => {
    if (!route) return;
    setOpen(false);
    navigate(route);
  };

  // ---------------------------------------------------------------------
  // Render: always-on floating launcher + slide-in panel
  // ---------------------------------------------------------------------

  return (
    <>
      {/* Launcher (floating, bottom-right). Hidden while panel is open. */}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="fixed z-40 bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-evegah-primary text-white shadow-lg shadow-evegah-primary/30 hover:opacity-95"
          aria-label="Open chatbot"
          title="Chat with Eve"
        >
          <Bot size={22} />
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div
          className={`fixed z-50 bottom-5 right-5 w-[92vw] sm:w-[400px] max-w-md rounded-2xl bg-white border border-evegah-border shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
            minimized ? "h-14" : "h-[560px] max-h-[80vh]"
          }`}
          role="dialog"
          aria-label="Eve chatbot"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-evegah-primary to-violet-600 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
                <Bot size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight inline-flex items-center gap-1">
                  Eve <Sparkles size={11} className="text-yellow-300" />
                </p>
                <p className="text-[11px] text-white/80 leading-tight">AI assistant · always online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized((v) => !v)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/15"
                aria-label={minimized ? "Restore" : "Minimize"}
              >
                <Minimize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/15"
                aria-label="Close chatbot"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!minimized ? (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-evegah-bg/40">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full shrink-0 ${
                        m.role === "user"
                          ? "bg-evegah-primary text-white"
                          : "bg-white text-evegah-primary border border-evegah-border"
                      }`}
                    >
                      {m.role === "user" ? <UserIcon size={13} /> : <Bot size={13} />}
                    </span>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.role === "user"
                          ? "bg-evegah-primary text-white rounded-tr-md"
                          : "bg-white text-evegah-text border border-evegah-border rounded-tl-md"
                      }`}
                    >
                      <span>{renderInline(m.text)}</span>
                      {m.cta ? (
                        <button
                          type="button"
                          onClick={() => handleCta(m.cta.route)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-evegah-primary text-white px-2.5 py-1 text-xs font-semibold hover:opacity-95"
                        >
                          {m.cta.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {typing ? (
                  <div className="flex items-start gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-evegah-primary border border-evegah-border shrink-0">
                      <Bot size={13} />
                    </span>
                    <div className="rounded-2xl bg-white border border-evegah-border px-3 py-2 inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Quick prompts (only show before user types anything) */}
              {messages.length <= 1 ? (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleQuickPrompt(p)}
                      className="inline-flex items-center gap-1 rounded-full border border-evegah-border bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 hover:bg-brand-light/40 hover:text-evegah-primary"
                    >
                      <MessageSquare size={10} /> {p.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Composer */}
              <form
                className="border-t border-evegah-border bg-white px-3 py-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="flex-1 rounded-xl border border-evegah-border bg-evegah-bg/40 px-3 py-2 text-sm placeholder:text-gray-400 outline-none focus:border-evegah-primary"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-evegah-primary text-white disabled:opacity-50 hover:opacity-95"
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

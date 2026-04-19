"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const GEMINI_API_KEY = "AIzaSyC63ZWp6BeqSPwX4NBpTJoC3pGJyUY1niQ";
const GEMINI_MODEL = "gemini-2.0-flash";
const FINANCE_SYSTEM_PROMPT =
  "You are a finance-focused AI assistant for a loan and money guidance website. " +
  "Keep replies primarily about finance-related topics such as loans, credit scores, banking, insurance, taxes, budgeting, debt, savings, investing, business finance, and risk analysis. " +
  "If a user asks something unrelated, briefly redirect the conversation back to finance and offer help with a related money topic instead. " +
  "Use clear, practical language and avoid pretending to provide regulated professional advice.";

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I am your AI bot. I mainly help with finance topics like loans, credit scores, budgeting, banking, and investment basics.",
  },
];

export default function FinanceChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: FINANCE_SYSTEM_PROMPT }],
              },
              {
                role: "model",
                parts: [
                  {
                    text: "Understood. I will stay focused on finance-related help and gently redirect unrelated requests.",
                  },
                ],
              },
              ...nextMessages.map((message) => ({
                role: message.role === "assistant" ? "model" : "user",
                parts: [{ text: message.content }],
              })),
            ],
            generationConfig: {
              temperature: 0.8,
              topP: 0.95,
              maxOutputTokens: 512,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with ${response.status}`);
      }

      const data = await response.json();
      const assistantReply =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("")
          .trim() || "I could not generate a response just now.";

      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantReply },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting Gemini.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I hit an error talking to Gemini: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close AI chatbot" : "Open AI chatbot"}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          width: "72px",
          height: "72px",
          border: 0,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #2563eb, #0f172a)",
          color: "#ffffff",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 24px 45px rgba(37,99,235,0.35)",
          cursor: "pointer",
          zIndex: 9999,
        }}
      >
        <BotIcon large />
      </button>

      {isOpen && (
        <section
          aria-label="AI chatbot"
          style={{
            position: "fixed",
            right: "24px",
            bottom: "112px",
            width: "min(380px, calc(100vw - 32px))",
            height: "min(620px, calc(100vh - 148px))",
            background: "rgba(15, 23, 42, 0.96)",
            color: "#e2e8f0",
            borderRadius: "28px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.35)",
            zIndex: 9998,
            border: "1px solid rgba(148,163,184,0.18)",
          }}
        >
          <div
            style={{
              padding: "18px 18px 16px",
              borderBottom: "1px solid rgba(148,163,184,0.18)",
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.08))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "16px",
                    background: "rgba(59,130,246,0.16)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <BotIcon />
                </div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>AI Bot</div>
                  <div style={{ fontSize: "0.86rem", color: "#94a3b8" }}>
                    Finance-focused Gemini chat
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#cbd5e1",
                  fontSize: "20px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background:
                "radial-gradient(circle at top, rgba(37,99,235,0.16), transparent 35%)",
            }}
          >
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "12px 14px",
                    borderRadius: isUser
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    background: isUser
                      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                      : "rgba(30, 41, 59, 0.95)",
                    color: "#f8fafc",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
                  }}
                >
                  {message.content}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 14px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "rgba(30, 41, 59, 0.95)",
                  color: "#cbd5e1",
                }}
              >
                Gemini is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              padding: "16px",
              borderTop: "1px solid rgba(148,163,184,0.18)",
              background: "#0f172a",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about loans, banking, credit, or finance..."
                style={{
                  flex: 1,
                  resize: "none",
                  minHeight: "54px",
                  maxHeight: "140px",
                  borderRadius: "18px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "#1e293b",
                  color: "#f8fafc",
                  padding: "14px 16px",
                  outline: "none",
                  fontSize: "0.98rem",
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  minWidth: "72px",
                  height: "54px",
                  border: 0,
                  borderRadius: "18px",
                  background:
                    loading || !input.trim()
                      ? "rgba(71,85,105,0.9)"
                      : "linear-gradient(135deg, #38bdf8, #2563eb)",
                  color: "#ffffff",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  fontWeight: 700,
                }}
              >
                Send
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

function BotIcon({ large = false }: { large?: boolean }) {
  const size = large ? 34 : 24;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="14" y="18" width="36" height="28" rx="12" fill="currentColor" />
      <rect x="24" y="10" width="16" height="8" rx="4" fill="currentColor" />
      <circle cx="26" cy="32" r="4" fill="#0f172a" />
      <circle cx="38" cy="32" r="4" fill="#0f172a" />
      <path
        d="M24 41C27 43.6667 37 43.6667 40 41"
        stroke="#0f172a"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M32 10V5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

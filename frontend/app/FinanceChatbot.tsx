"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";
const FINANCE_SYSTEM_PROMPT =
  "You are FinTech-Approve's official AI assistant for financial and loan guidance. " +
  "Keep replies concise, professional, and directly related to topics like loans, credit scores, debt management, budgeting, or our approval predictor. " +
  "Use Markdown for formatting (lists, bold text). " +
  "If asked something non-financial, politely redirect them to finance. Be very helpful and always prioritize giving excellent well-structured advice.";

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content: "👋 **Hello!** I am the FinTech Assistant. I can help answer questions about credit scores, loan types, debt management, and our prediction models. \n\nHow can I help you today?",
  },
];

export default function FinanceChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll to the bottom whenever messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      // Filter out the initial starter message from the API request to prevent role sequence formatting errors (e.g. 400 Bad Request)
      const apiMessages = nextMessages.filter((msg, idx) => !(idx === 0 && msg.role === "assistant"));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: FINANCE_SYSTEM_PROMPT }]
            },
            contents: apiMessages.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Too many requests (429). Please wait a moment .");
        }
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const assistantReply =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("")
          .trim() || "Sorry, I am unable to generate a response right now.";

      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantReply },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `⚠️ **Oops!** Encountered an error: ${error instanceof Error ? error.message : "Network issue"}. Please try again later.`,
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

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Reset height to allow shrinking
    e.target.style.height = "44px";
    // Set to scrollHeight up to max-height defined in CSS
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open AI chatbot"
            onClick={() => setIsOpen(true)}
            className="fixed right-6 bottom-6 w-[64px] h-[64px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-[0_10px_40px_rgba(37,99,235,0.4)] flex items-center justify-center z-[9999] hover:shadow-[0_15px_50px_rgba(37,99,235,0.6)] transition-shadow duration-300"
          >
            <BotIcon large />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            aria-label="AI chatbot"
            className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 w-[calc(100vw-32px)] sm:w-[400px] h-[calc(100vh-100px)] sm:h-[650px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] z-[9998] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 shadow-sm rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <BotIcon />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none text-lg">FinTech Assistant</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Online | AI Powered</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100/50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-full transition-all"
                aria-label="Close chatbot"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 pb-2 flex flex-col gap-5 bg-slate-50/50 dark:bg-slate-900/50">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
                  >
                    <div
                      className={`max-w-[88%] px-4 py-3.5 text-[15px] leading-relaxed shadow-sm
                        ${isUser
                          ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-[20px] rounded-tr-[4px]"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[20px] rounded-tl-[4px] border border-slate-100 dark:border-slate-700/50"
                        }
                      `}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-md font-bold mt-3 mb-1" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-outside list-disc pl-5 mb-3 space-y-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-outside list-decimal pl-5 mb-3 space-y-1" {...props} />,
                              li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...props} />,
                              a: ({ node, ...props }) => <a className="text-blue-600 dark:text-blue-400 hover:underline font-medium" {...props} />,
                              blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-3 my-2 italic text-slate-600 dark:text-slate-400" {...props} />
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start w-full"
                >
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-[20px] rounded-tl-[4px] px-5 py-4 shadow-sm text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span className="text-[14px] font-medium tracking-wide">Assistant is typing</span>
                    <span className="flex gap-1.5 pb-1">
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-[24px] p-2 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/30 transition-all shadow-sm">
                <textarea
                  value={input}
                  onChange={adjustTextareaHeight}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask a finance question..."
                  className="flex-1 max-h-[120px] min-h-[44px] bg-transparent resize-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-[15px] px-3 py-2.5 overflow-y-auto custom-scrollbar"
                  style={{ height: "44px" }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center rounded-[18px] bg-blue-600 text-white disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 transition-colors hover:bg-blue-700 disabled:shadow-none shadow-md mb-0 mr-0"
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </div>
              <div className="text-center mt-3 mb-1">
                <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500">Not financial advice. AI can make mistakes.</span>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

// -------------------------------------------------------------
// Icons
// -------------------------------------------------------------

function BotIcon({ large = false }: { large?: boolean }) {
  const size = large ? 32 : 24;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 30 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="translate-x-[2px] translate-y-[-1px]">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import type {
  AccountBriefPayload,
  CustomerData,
  OverallSentimentPayload,
  SlackInsightPayload,
} from "@/lib/types";
import { answerCustomerQuestion } from "@/lib/customer-assistant";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { label: string; url: string | null }[];
}

export function ChatWidget({
  customerName,
  data,
  brief,
  slackInsight,
  overallSentiment,
  variant = "floating",
}: {
  customerName: string;
  data: CustomerData;
  brief: AccountBriefPayload;
  slackInsight: SlackInsightPayload | null;
  overallSentiment: OverallSentimentPayload | null;
  variant?: "floating" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const grounded = answerCustomerQuestion({
        question: text,
        data,
        brief,
        slackInsight,
        overallSentiment,
      });
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: grounded.answer,
        citations: grounded.citations,
      };
      setMessages((prev) => [...prev, reply]);
      setLoading(false);
    }, 800);
  }

  const buttonClasses =
    variant === "inline"
      ? "inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-sage-900 active:translate-y-px"
      : "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-central-600 text-white shadow-lg transition hover:bg-central-500 active:translate-y-px";

  const panelClasses =
    variant === "inline"
      ? "fixed right-6 top-24 z-50 flex h-[480px] w-[380px] flex-col overflow-hidden rounded-xl border border-sage-200 bg-white shadow-xl"
      : "fixed bottom-6 right-6 z-50 flex h-[480px] w-[380px] flex-col overflow-hidden rounded-xl border border-sage-200 bg-white shadow-xl";

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={buttonClasses}
          title={`Ask about ${customerName}`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {variant === "inline" ? <span>Ask anything about {customerName}</span> : null}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={panelClasses}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sage-100 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-sage-900">Ask about {customerName}</div>
              <div className="text-3xs text-sage-400">Grounded in deals, sentiment, issues, and activity</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-sage-400 transition hover:bg-sage-75 hover:text-sage-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-central-50">
                  <svg className="h-5 w-5 text-central-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <p className="text-xs text-sage-500">Ask anything about {customerName}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {[
                    "What's the status?",
                    "Any blockers?",
                    "Who's the DRI?",
                    "ARR summary",
                    "What changed recently?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="rounded-full border border-sage-200 px-2.5 py-1 text-3xs text-sage-500 transition hover:border-central-300 hover:text-central-600"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 ${msg.role === "user" ? "flex justify-end" : ""}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-central-600 text-white"
                      : "bg-sage-50 text-sage-700"
                  }`}
                >
                  <div>{msg.content}</div>
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.citations.map((citation, index) =>
                        citation.url ? (
                          <a
                            key={`${citation.label}-${index}`}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-sage-200 bg-white px-2 py-0.5 text-3xs font-medium text-central-700 hover:text-central-800"
                          >
                            Source {index + 1}
                          </a>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-1 rounded-lg bg-sage-50 px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-sage-100 px-4 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="h-9 flex-1 rounded-lg border border-sage-300 bg-white px-3 text-sm text-sage-900 placeholder:text-sage-400 focus:border-central-400 focus:outline-none focus:ring-2 focus:ring-central-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-central-600 text-white transition hover:bg-central-500 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

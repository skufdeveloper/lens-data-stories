"use client";
import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  LoaderCircle,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { ChatReply, Report } from "@/lib/types";

export function AskData({ report }: { report: Report }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    { question: string; reply?: ChatReply; error?: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function send(q: string) {
    if (busy || q.trim().length < 2) return;
    setQuestion("");
    setBusy(true);
    setMessages((m) => [...m, { question: q }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: report.source,
          question: q,
          demo: report.mode === "demo",
        }),
        signal: AbortSignal.timeout(58000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Не удалось получить ответ.");
      setMessages((m) =>
        m.map((message, i) =>
          i === m.length - 1 ? { ...message, reply: data } : message,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Ответ занял слишком много времени. Попробуйте ещё раз.";
      setMessages((m) =>
        m.map((item, i) =>
          i === m.length - 1 ? { ...item, error: message } : item,
        ),
      );
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <section className="ask-card" id="ask-data">
      <div className="ask-heading">
        <div className="ask-symbol">
          <Sparkles size={19} />
        </div>
        <div>
          <h3>У каждой цифры есть ответ</h3>
          <p>Спросите о том, что важно именно вам.</p>
        </div>
        <span className="ask-source">
          <span className="tiny-dot" />
          {report.mode === "ai"
            ? "GigaChat · по вашему отчёту"
            : "Демо · ответы по правилам"}
        </span>
      </div>
      <div className="messages" role="log" aria-live="polite">
        {messages.map((message, i) => (
          <div className="message-pair" key={i}>
            <div className="user-message">
              <MessageCircle size={14} />
              {message.question}
            </div>
            {message.reply ? (
              <div className="assistant-message">
                <CornerDownRight size={18} />
                <div>
                  <p>{message.reply.answer}</p>
                  {message.reply.evidence.length > 0 && (
                    <details>
                      <summary>
                        Подтверждения из отчёта: {message.reply.evidence.length}
                        <ArrowDown size={12} />
                      </summary>
                      {message.reply.evidence.map((f) => (
                        <div className="evidence" key={f.id}>
                          <b>{f.origin}</b>
                          <span>{f.text}</span>
                        </div>
                      ))}
                    </details>
                  )}
                  {message.reply.mode === "demo" &&
                    message.reply.evidence.length === 0 && (
                      <small>
                        Демочат распознаёт ограниченный набор вопросов. Для
                        свободных вопросов подключите GigaChat.
                      </small>
                    )}
                </div>
              </div>
            ) : message.error ? (
              <div className="chat-error" role="alert">
                {message.error}
                <button onClick={() => send(message.question)} disabled={busy}>
                  Повторить
                </button>
              </div>
            ) : (
              <div className="thinking">
                <span />
                <span />
                <span />
                Ищу подтверждения в отчёте
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="suggestions">
        {report.suggestions.map((q) => (
          <button disabled={busy} key={q} onClick={() => send(q)}>
            {q}
            <ArrowUp size={12} />
          </button>
        ))}
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(question.trim());
        }}
      >
        <Sparkles size={18} />
        <label className="sr-only" htmlFor="data-question">
          Спроси что-нибудь про эти данные
        </label>
        <input
          id="data-question"
          ref={input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Спроси что-нибудь про эти данные…"
          maxLength={500}
          disabled={busy}
        />
        <button
          aria-label="Отправить вопрос"
          disabled={busy || question.trim().length < 2}
        >
          {busy ? (
            <LoaderCircle size={19} className="spin" />
          ) : (
            <ArrowUp size={19} />
          )}
        </button>
      </form>
      <div className="ask-disclaimer">
        Ответы опираются на текущий отчёт. Каждый вопрос рассматривается
        отдельно.
      </div>
    </section>
  );
}

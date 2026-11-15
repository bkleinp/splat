"use client";

import { useEffect, useRef, useState } from "react";
// Type-only: importing values from "@splat/llm" here would bundle the listing context into the client.
import type { Pose } from "@splat/llm/spatial";

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** User turns: the camera pose they asked from (the server works out the location). */
  pose?: Pose;
};

// "location" (where the server placed the question) is sent first; the answer doesn't need it client-side.
type StreamEvent =
  | { type: "location" }
  | { type: "text"; text: string }
  | { type: "replace"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

const LOCATION_SUGGESTIONS = [
  "Tell me about this room",
  "What's this in front of me?",
  "Is the furniture included?",
  "What are the counters made of?",
];

// When the visitor's location isn't tracked, "this room" can't be resolved.
const GENERAL_SUGGESTIONS = [
  "What are the highlights of this home?",
  "How many bedrooms and bathrooms?",
  "What are the counters made of?",
  "What's nearby?",
];

/**
 * Pulls "[Source label]" citations out of an answer so they render as chips.
 * Only labels this house actually has are treated as citations; any other
 * bracketed text stays in the prose. While streaming, a half-written "[Rea"
 * at the end is hidden until it closes.
 */
function splitCitations(text: string, sources: string[], streaming: boolean) {
  const byLower = new Map(sources.map((s) => [s.toLowerCase(), s]));
  const cited: string[] = [];

  let body = text.replace(/\s*\[([^\[\]\n]{1,80})\]/g, (match, label: string) => {
    const canonical = byLower.get(label.trim().toLowerCase());
    if (!canonical) return match;
    if (!cited.includes(canonical)) cited.push(canonical);
    return "";
  });

  if (streaming) {
    const open = body.lastIndexOf("[");
    if (open > body.lastIndexOf("]")) body = body.slice(0, open);
  }

  // Tidy spacing left behind where a citation sat before punctuation or a line break.
  body = body.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]+\n/g, "\n").trim();
  return { body, cited };
}

/** Reads the /api/chat NDJSON stream, calling onEvent once per line. */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    // stream: true keeps multi-byte characters split across chunks intact.
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
}

export function Chat({
  houseSlug,
  houseTitle,
  sources,
  getPose,
  onTyping,
  onClose,
}: {
  houseSlug: string;
  houseTitle: string;
  sources: string[];
  /** Reads the camera pose at the moment a question is sent. Absent when location isn't tracked. */
  getPose?: () => Pose | null;
  /** Fires when the question box gains/loses focus. */
  onTyping?: (typing: boolean) => void;
  /** When set, the header shows a button to hide the chat. */
  onClose?: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;

    // The pose is read once, right as the question is sent; the server resolves it.
    const asked: Turn = { role: "user", content: text, pose: getPose?.() ?? undefined };
    const next: Turn[] = [...turns, asked];
    setTurns(next);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseSlug,
          messages: next.map(({ role, content, pose }) => ({ role, content, pose })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "The assistant couldn't answer just now. Please try again.");
      }

      let answer = "";
      await readEvents(res.body, (event) => {
        if (event.type === "text") answer += event.text;
        else if (event.type === "replace") answer = event.text;
        else if (event.type === "error") throw new Error(event.error);
        else return;
        setTurns([...next, { role: "assistant", content: answer }]);
      });
      if (!answer) throw new Error("The assistant stopped before answering. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      // Drop the unanswered question so history stays user/assistant alternating.
      setTurns(turns);
      setInput(text);
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="chat">
      <header className="chat-header">
        {onClose && (
          <button type="button" className="chat-close" aria-label="Hide chat" onClick={onClose}>
            ×
          </button>
        )}
        <strong>Ask about this home</strong>
        <span className="muted small">{houseTitle}</span>
      </header>

      <div className="chat-log" ref={logRef}>
        {turns.length === 0 && (
          <div className="suggestions">
            {(getPose ? LOCATION_SUGGESTIONS : GENERAL_SUGGESTIONS).map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => send(s)} disabled={pending}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => {
          if (t.role === "user") {
            return (
              <div key={i} className="bubble user">
                {t.content}
              </div>
            );
          }
          const streaming = pending && i === turns.length - 1;
          const { body, cited } = splitCitations(t.content, sources, streaming);
          return (
            <div key={i} className="bubble assistant">
              {body}
              {cited.length > 0 && (
                <div className="bubble-sources">
                  {cited.map((label) => (
                    <span key={label} className="chip source">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {pending && turns[turns.length - 1]?.role === "user" && <div className="bubble assistant muted">Thinking…</div>}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => onTyping?.(true)}
          onBlur={() => onTyping?.(false)}
          placeholder="Ask about this home…"
          maxLength={2000}
          disabled={pending}
          aria-label="Your question"
        />
        <button type="submit" disabled={pending || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}

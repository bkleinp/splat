"use client";

import { useEffect, useRef, useState } from "react";

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** User turns: the view they asked from, and where the server resolved that to. */
  viewId?: string;
  locationLabel?: string;
};

type StreamEvent =
  | { type: "location"; location: { primaryZone?: { name: string } } }
  | { type: "text"; text: string }
  | { type: "replace"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

const SUGGESTIONS = [
  "Tell me about this room",
  "What's the flooring here?",
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
  currentView,
}: {
  houseSlug: string;
  houseTitle: string;
  sources: string[];
  /** The photo the visitor is looking at right now. */
  currentView: { id: string; label: string };
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

    let asked: Turn = { role: "user", content: text, viewId: currentView.id, locationLabel: currentView.label };
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
          messages: next.map(({ role, content, viewId }) => ({ role, content, viewId })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      let answer = "";
      const show = () => {
        const withQuestion = [...turns, asked];
        setTurns(answer ? [...withQuestion, { role: "assistant", content: answer }] : withQuestion);
      };

      await readEvents(res.body, (event) => {
        if (event.type === "location") {
          // Show where the server actually placed the question.
          asked = { ...asked, locationLabel: event.location.primaryZone?.name ?? "Unknown location" };
        } else if (event.type === "text") answer += event.text;
        else if (event.type === "replace") answer = event.text;
        else if (event.type === "error") throw new Error(event.error);
        show();
      });
      if (!answer) throw new Error("The assistant stopped before answering.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
        <strong>Ask about this home</strong>
        <span className="muted small">
          {houseTitle} · <span className="chat-location">Viewing: {currentView.label}</span>
        </span>
      </header>

      <div className="chat-log" ref={logRef}>
        {turns.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => send(s)} disabled={pending}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => {
          if (t.role === "user") {
            return (
              <div key={i} className="turn-user">
                <div className="bubble user">{t.content}</div>
                {t.locationLabel && <span className="turn-location muted">in {t.locationLabel}</span>}
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
          placeholder={`Ask about the ${currentView.label.toLowerCase()}…`}
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

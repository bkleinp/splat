"use client";

import { useEffect, useRef, useState } from "react";
// Type-only: importing values from "@splat/llm" here would bundle the listing context into the client.
import type { Pose, ResolvedLocation } from "@splat/llm/spatial";

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** User turns: the camera pose they asked from (the server works out the location). */
  pose?: Pose;
};

// "location" (where the server placed the question) is sent first; only the dev readout uses it.
type StreamEvent =
  | { type: "location"; location: ResolvedLocation }
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

const deg = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`;

/**
 * Dev-only testing aid above the question box: where the last question was asked from, as the
 * server resolved it, i.e. the location context the model was given.
 */
function LocationReadout({ context }: { context: { pose: Pose; location: ResolvedLocation } | null }) {
  if (!context) {
    return (
      <div className="chat-context">
        <div>
          <b>Position:</b> – <span className="muted">(ask a question)</span>
        </div>
        <div>
          <b>Facing:</b> –
        </div>
      </div>
    );
  }
  const { pose, location } = context;
  const [x, y, z] = pose.position;
  const [fx, fy, fz] = pose.forward ?? [0, 0, 1];
  const named = (o: { zone: { name: string }; room?: string; inRoom: boolean }) =>
    o.inRoom || !o.room ? o.zone.name : `${o.zone.name} (${o.room})`;
  const place = location.primaryZone
    ? [location.primaryZone.name, ...location.ancestorZones.map((a) => a.name)].join(" · ") +
      (location.resolution === "near-zone" ? " (near)" : "")
    : "unknown";
  const [first, ...rest] = location.rayHits;
  return (
    <div className="chat-context">
      <div>
        <b>Position:</b> {place} <span className="muted">· confidence {location.confidence}</span>
      </div>
      <div className="muted">
        x {x.toFixed(2)}, y {y.toFixed(2)}, z {z.toFixed(2)} · heading {deg(Math.atan2(fx, fz))}, pitch{" "}
        {deg(Math.atan2(fy, Math.hypot(fx, fz)))}
      </div>
      <div>
        <b>Facing:</b>{" "}
        {first ? (
          <>
            {named(first)} <span className="muted">{first.metres.toFixed(1)} m</span>
            {rest.length > 0 && (
              <span className="muted"> · then {rest.map((h) => `${named(h)} ${h.metres.toFixed(1)} m`).join(", ")}</span>
            )}
          </>
        ) : (
          <span className="muted">nothing on the line of sight</span>
        )}
      </div>
      {location.nearbyObjects.length > 0 && (
        <div className="muted">
          <b>Around:</b> {location.nearbyObjects.map((o) => `${named(o)} ${o.metres.toFixed(1)} m ${o.bearing}`).join(", ")}
        </div>
      )}
    </div>
  );
}

export function Chat({
  houseSlug,
  houseTitle,
  sources,
  getPose,
  onTyping,
  onClose,
  onPendingChange,
  showLocation = false,
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
  /** Fires when an answer starts or finishes coming in. */
  onPendingChange?: (pending: boolean) => void;
  /** Dev only: show the Position / Facing readout for the last question. */
  showLocation?: boolean;
}) {
  const [lastContext, setLastContext] = useState<{ pose: Pose; location: ResolvedLocation } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => onPendingChange?.(pending), [pending, onPendingChange]);

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
        if (event.type === "location") {
          const sentPose = asked.pose;
          if (sentPose) setLastContext({ pose: sentPose, location: event.location });
          else setLastContext(null);
          return;
        }
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
          <button type="button" className="chat-close" aria-label="Minimize chat" title="Minimize (Esc)" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
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

      {showLocation && getPose && <LocationReadout context={lastContext} />}

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
          placeholder="Ask any question…"
          maxLength={2000}
          disabled={pending}
          aria-label="Your question"
        />
        <button type="submit" disabled={pending || !input.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </aside>
  );
}

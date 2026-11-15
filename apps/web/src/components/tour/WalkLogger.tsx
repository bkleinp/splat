"use client";

import { useEffect, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import type { Pose } from "@splat/llm/spatial";
import { heading, pitch, readPose } from "./camera";

// Dev-only zone-authoring aid (restored from e061e9e, plus a floor for multi-storey homes): a live
// readout of the camera, and a logger that records where you stand, which floor you're on, which
// way you face (side to side and up/down) and a description, exported as a .txt walkthrough log.
// The log is replayed against the scene's collision to place room and object boxes in
// llm/src/*.ts. Reads the viewer locally; nothing is sent anywhere.

const SAMPLE_MS = 100;

type Floor = 1 | 2;

/** One logged spot. */
type LogEntry = {
  x: number;
  y: number;
  z: number;
  floor?: Floor;
  heading: number;
  pitch: number;
  axis: string;
  note: string;
  at: string;
};

/** "+x −z" style label for a heading: the axes you're mostly facing along. */
function axisLabel(pose: Pose): string {
  const [fx, , fz] = pose.forward ?? [0, 0, 1];
  const parts: string[] = [];
  // An axis counts once it's at least ~22° of the heading (sin 22.5° ≈ 0.38).
  const len = Math.hypot(fx, fz) || 1;
  if (Math.abs(fx / len) > 0.38) parts.push(fx > 0 ? "+x" : "-x");
  if (Math.abs(fz / len) > 0.38) parts.push(fz > 0 ? "+z" : "-z");
  return parts.join(" ");
}

const fmt = (n: number) => n.toFixed(2);
const floorName = (f: Floor) => (f === 1 ? "ground" : "upstairs");

// The log survives refreshes in this browser; storage being unavailable (private window,
// blocked) just means it lives in memory.
const storageKey = (houseSlug: string) => `splat:coord-log:${houseSlug}`;
function loadLog(houseSlug: string): LogEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(houseSlug));
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}
function saveLog(houseSlug: string, log: LogEntry[]) {
  try {
    localStorage.setItem(storageKey(houseSlug), JSON.stringify(log));
  } catch {
    // Storage unavailable: keep the in-memory log.
  }
}

function logToText(houseSlug: string, log: LogEntry[], floors: boolean): string {
  const lines = [
    `# Coordinate log: ${houseSlug}`,
    `# Exported ${new Date().toISOString()}`,
    "# Scene metres; y is the camera (eye) height. Heading: 0 = facing +z, 90 = +x, 180 = -z, -90 = -x.",
    "# Pitch: camera tilt, positive = looking up, negative = looking down.",
    ...(floors ? ["# Floor: 1 = ground floor, 2 = upstairs (as set in the logger)."] : []),
    "",
  ];
  log.forEach((e, i) => {
    const pos = `x=${fmt(e.x)} y=${fmt(e.y)} z=${fmt(e.z)}`;
    const floor = floors && e.floor ? `  floor=${e.floor}` : "";
    const facing = `heading=${e.heading.toFixed(0)}deg pitch=${e.pitch.toFixed(0)}deg (${e.axis || "level"})`;
    lines.push(`${String(i + 1).padStart(3)}. ${pos}${floor}  ${facing}  | ${e.note || "(no description)"}  [${e.at}]`);
  });
  return lines.join("\n") + "\n";
}

export function WalkLogger({
  viewer,
  houseSlug,
  floors,
  upperFloorFrom,
  defaultOpen,
  onTyping,
}: {
  viewer: ViewerHandle | null;
  houseSlug: string;
  /** Multi-storey home: log which floor each spot is on. */
  floors: boolean;
  /** Camera height where the upper floor starts, for the "looks like" hint. */
  upperFloorFrom?: number;
  defaultOpen: boolean;
  /** Fires when the description box gains/loses focus, so the viewer's WASD can be paused. */
  onTyping?: (typing: boolean) => void;
}) {
  const [pose, setPose] = useState<Pose | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [note, setNote] = useState("");
  const [floor, setFloor] = useState<Floor>(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => setLog(loadLog(houseSlug)), [houseSlug]);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  useEffect(() => {
    if (!viewer || !open) return;
    const timer = setInterval(() => {
      if (viewer.state.loaded) setPose(readPose(viewer));
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [viewer, open]);

  if (!open) {
    return (
      <button type="button" className="walk-logger-open" onClick={() => setOpen(true)}>
        Logger{log.length ? ` (${log.length})` : ""}
      </button>
    );
  }

  const updateLog = (next: LogEntry[]) => {
    setLog(next);
    saveLog(houseSlug, next);
  };

  const logHere = () => {
    // Read fresh, so the entry is exactly where you are when you click.
    const now = viewer?.state.loaded ? readPose(viewer) : null;
    if (!now) return;
    const [x, y, z] = now.position;
    updateLog([
      ...log,
      {
        x,
        y,
        z,
        ...(floors ? { floor } : {}),
        heading: heading(now),
        pitch: pitch(now),
        axis: axisLabel(now),
        note: note.trim(),
        at: new Date().toLocaleTimeString(),
      },
    ]);
    setNote("");
  };

  const download = () => {
    const blob = new Blob([logToText(houseSlug, log, floors)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${houseSlug}-coords-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deg = pose ? heading(pose) : 0;
  const tilt = pose ? pitch(pose) : 0;
  const guess: Floor | null = pose && upperFloorFrom !== undefined ? (pose.position[1] >= upperFloorFrom ? 2 : 1) : null;

  return (
    <div className="walk-logger">
      <button type="button" className="walk-logger-close" aria-label="Hide logger" onClick={() => setOpen(false)}>
        ×
      </button>
      {!pose ? (
        <div>Waiting for the 3D tour…</div>
      ) : (
        <>
          <div className="walk-logger-row">
            {/* Top-down compass on the zone map's axes: +x right, +z down. */}
            <svg className="walk-logger-compass" viewBox="-20 -20 40 40" aria-hidden="true">
              <circle r="18" />
              <text x="0" y="-11">−z</text>
              <text x="0" y="15">+z</text>
              <text x="-13" y="2">−x</text>
              <text x="13" y="2">+x</text>
              <path d="M0 10 L-4 -2 L0 1 L4 -2 Z" transform={`rotate(${-deg})`} />
            </svg>
            <div>
              <div>
                <b>x</b> {fmt(pose.position[0])} · <b>z</b> {fmt(pose.position[2])} · <b>y</b> {fmt(pose.position[1])}
              </div>
              <div>
                <b>heading</b> {deg.toFixed(0)}° ({axisLabel(pose) || "level"}) · <b>pitch</b> {tilt.toFixed(0)}°{" "}
                <span className="walk-logger-muted">({tilt > 5 ? "up" : tilt < -5 ? "down" : "level"})</span>
              </div>
            </div>
          </div>

          {floors && (
            <div className="walk-logger-floor" role="group" aria-label="Floor">
              <span>Floor</span>
              {([1, 2] as const).map((f) => (
                <button key={f} type="button" aria-pressed={floor === f} onClick={() => setFloor(f)}>
                  {f} · {floorName(f)}
                </button>
              ))}
              {guess !== null && guess !== floor && (
                <span className="walk-logger-warn">height looks like floor {guess}</span>
              )}
            </div>
          )}

          <form
            className="walk-logger-form"
            onSubmit={(e) => {
              e.preventDefault();
              logHere();
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={() => onTyping?.(true)}
              onBlur={() => onTyping?.(false)}
              placeholder="e.g. fridge in kitchen"
              maxLength={200}
              aria-label="Description for this spot"
            />
            <button type="submit">Log</button>
          </form>

          <div className="walk-logger-buttons">
            <span className="walk-logger-muted">{log.length} logged</span>
            <button type="button" onClick={download} disabled={log.length === 0}>
              Download .txt
            </button>
            {log.length > 0 &&
              (confirmClear ? (
                <>
                  <button type="button" onClick={() => (updateLog([]), setConfirmClear(false))}>
                    Yes, clear all
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => updateLog(log.slice(0, -1))}>
                    Undo last
                  </button>
                  <button type="button" onClick={() => setConfirmClear(true)}>
                    Clear
                  </button>
                </>
              ))}
          </div>
          {log.length > 0 && (
            <ol className="walk-logger-entries" start={Math.max(1, log.length - 2)}>
              {log.slice(-3).map((e, i) => (
                <li key={`${log.length}-${i}`}>
                  {fmt(e.x)}, {fmt(e.z)}
                  {e.floor ? ` · F${e.floor}` : ""} · {e.heading.toFixed(0)}° / {e.pitch.toFixed(0)}° · {e.note || "(no description)"}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

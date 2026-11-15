"use client";

import { useEffect, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import type { Pose } from "@splat/llm/spatial";
import { heading, pitch, readPose } from "./camera";

const SAMPLE_MS = 100;

type Corner = [number, number];

/** One logged spot: where you stood, which way you faced (and how far up/down), and your note. */
type LogEntry = { x: number; y: number; z: number; heading: number; pitch?: number; axis: string; note: string; at: string };

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

// The log survives refreshes in this browser; it's a convenience, so storage
// being unavailable (private window, blocked) just means it lives in memory.
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

function logToText(houseSlug: string, log: LogEntry[]): string {
  const lines = [
    `# Coordinate log: ${houseSlug}`,
    `# Exported ${new Date().toISOString()}`,
    "# Scene metres. Heading: 0 = facing +z, 90 = +x, 180 = -z, -90 = -x (same axes as zone boxes in llm/src/houses.ts).",
    "# Pitch: camera tilt, positive = looking up, negative = looking down.",
    "",
  ];
  log.forEach((e, i) => {
    const pos = `x=${fmt(e.x)} y=${fmt(e.y)} z=${fmt(e.z)}`;
    const tilt = e.pitch === undefined ? "" : ` pitch=${e.pitch.toFixed(0)}deg`;
    const facing = `heading=${e.heading.toFixed(0)}deg${tilt} (${e.axis || "level"})`;
    lines.push(`${String(i + 1).padStart(3)}. ${pos}  ${facing}  | ${e.note || "(no description)"}  [${e.at}]`);
  });
  return lines.join("\n") + "\n";
}

/**
 * Zone-authoring aid: live camera position and facing, read locally from the
 * viewer (no server calls).
 * - Log: records position, heading and a description; Download .txt exports them.
 * - Corner 1 / Corner 2: turn two spots into an area(x0, x1, z0, z1) for a
 *   zone's boxes in llm/src/houses.ts.
 */
export function CameraReadout({
  viewer,
  houseSlug,
  onTyping,
}: {
  viewer: ViewerHandle | null;
  houseSlug: string;
  /** Fires when the description box gains/loses focus, so the viewer's WASD can be paused. */
  onTyping?: (typing: boolean) => void;
}) {
  const [pose, setPose] = useState<Pose | null>(null);
  const [open, setOpen] = useState(true);
  const [corners, setCorners] = useState<[Corner | null, Corner | null]>([null, null]);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => setLog(loadLog(houseSlug)), [houseSlug]);

  useEffect(() => {
    if (!viewer || !open) return;
    const timer = setInterval(() => {
      if (viewer.state.loaded) setPose(readPose(viewer));
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [viewer, open]);

  if (!open) {
    return (
      <button type="button" className="camera-readout-open" onClick={() => setOpen(true)}>
        Show coordinates{log.length ? ` (${log.length} logged)` : ""}
      </button>
    );
  }

  const copy = (text: string) =>
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    });

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
      { x, y, z, heading: heading(now), pitch: pitch(now), axis: axisLabel(now), note: note.trim(), at: new Date().toLocaleTimeString() },
    ]);
    setNote("");
  };

  const download = () => {
    const blob = new Blob([logToText(houseSlug, log)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${houseSlug}-coords-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [c1, c2] = corners;
  const areaText =
    c1 && c2
      ? `area(${fmt(Math.min(c1[0], c2[0]))}, ${fmt(Math.max(c1[0], c2[0]))}, ${fmt(Math.min(c1[1], c2[1]))}, ${fmt(Math.max(c1[1], c2[1]))})`
      : null;
  const here: Corner | null = pose ? [pose.position[0], pose.position[2]] : null;
  const deg = pose ? heading(pose) : 0;

  return (
    <div className="camera-readout">
      <button type="button" className="camera-readout-close" aria-label="Hide coordinates" onClick={() => setOpen(false)}>
        ×
      </button>
      {!pose ? (
        <div>Waiting for the 3D tour…</div>
      ) : (
        <>
          <div className="camera-readout-row">
            {/* Top-down compass on the zone map's axes: +x right, +z down. */}
            <svg className="camera-compass" viewBox="-20 -20 40 40" aria-hidden="true">
              <circle r="18" />
              <text x="0" y="-11">−z</text>
              <text x="0" y="15">+z</text>
              <text x="-13" y="2">−x</text>
              <text x="13" y="2">+x</text>
              <path d="M0 10 L-4 -2 L0 1 L4 -2 Z" transform={`rotate(${-deg})`} />
            </svg>
            <div>
              <div>
                <b>x</b> {fmt(pose.position[0])} · <b>y</b> {fmt(pose.position[1])} · <b>z</b> {fmt(pose.position[2])}
              </div>
              <div>
                <b>facing</b> {axisLabel(pose)} · {deg.toFixed(0)}° · <b>pitch</b> {pitch(pose).toFixed(0)}°{" "}
                <span className="camera-readout-muted">({pitch(pose) > 5 ? "up" : pitch(pose) < -5 ? "down" : "level"})</span>
              </div>
              <div className="camera-readout-muted">
                forward [{pose.forward!.map(fmt).join(", ")}]
              </div>
            </div>
          </div>

          <form
            className="camera-readout-log"
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
              placeholder="Description, e.g. fridge, left edge"
              maxLength={200}
              aria-label="Description for this spot"
            />
            <button type="submit">Log</button>
          </form>

          <div className="camera-readout-buttons">
            <span className="camera-readout-muted">{log.length} logged</span>
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
            <ol className="camera-readout-entries" start={Math.max(1, log.length - 2)}>
              {log.slice(-3).map((e, i) => (
                <li key={`${log.length}-${i}`}>
                  {fmt(e.x)}, {fmt(e.z)} · {e.heading.toFixed(0)}°{e.pitch !== undefined ? ` / ${e.pitch.toFixed(0)}°` : ""} ·{" "}
                  {e.note || "(no description)"}
                </li>
              ))}
            </ol>
          )}

          <div className="camera-readout-buttons">
            <button type="button" onClick={() => here && copy(`[${fmt(here[0])}, ${fmt(here[1])}]`)}>
              {copied?.startsWith("[") ? "Copied" : "Copy x, z"}
            </button>
            <button type="button" onClick={() => here && setCorners([here, c2])}>
              Corner 1
            </button>
            <button type="button" onClick={() => here && setCorners([c1, here])}>
              Corner 2
            </button>
          </div>
          {(c1 || c2) && (
            <div className="camera-readout-area">
              <span>
                {c1 ? `1: ${fmt(c1[0])}, ${fmt(c1[1])}` : "1: –"} · {c2 ? `2: ${fmt(c2[0])}, ${fmt(c2[1])}` : "2: –"}
              </span>
              {areaText && (
                <button type="button" onClick={() => copy(areaText)}>
                  {copied === areaText ? "Copied" : areaText}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { seatInReach, type Seat } from "@/lib/seats";
import { readPose } from "./camera";

// "Press F to sit": shown when the visitor walks up to a seat, and "Press F to stand up" while
// they sit. The key works anywhere on the page except while typing; the prompt itself is a button,
// for touch screens. Hidden in the floor plan.

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
};

export function SeatPrompt({
  viewer,
  getSeats,
  hidden,
}: {
  viewer: ViewerHandle;
  /** The seats to offer, read every frame (the settings page edits them live). */
  getSeats: () => readonly Seat[];
  /** Hide the prompt (the floor plan is showing). */
  hidden: boolean;
}) {
  const [seated, setSeated] = useState(() => viewer.isSeated());
  const [near, setNear] = useState<Seat | null>(null);

  // the latest values, for the key handler and the frame loop
  const live = useRef({ seated, near, hidden, getSeats });
  live.current = { seated, near, hidden, getSeats };

  useEffect(() => {
    const changed = viewer.events.on("seated:changed", (on: boolean) => setSeated(on));
    return () => changed.off();
  }, [viewer]);

  // find the seat in reach each frame, while walking
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { seated: isSeated, hidden: isHidden, getSeats: seats } = live.current;
      let next: Seat | null = null;
      if (!isSeated && !isHidden && viewer.state.loaded) {
        const pose = readPose(viewer);
        if (pose?.forward) next = seatInReach(seats(), pose.position, pose.forward);
      }
      if (next?.id !== live.current.near?.id || next?.name !== live.current.near?.name) setNear(next);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [viewer]);

  const act = () => {
    const { seated: isSeated, near: seat, hidden: isHidden } = live.current;
    if (isHidden || !viewer.state.loaded) return;
    if (isSeated) viewer.standUp();
    else if (seat) viewer.sitAt(seat);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyF" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
      if (!live.current.seated && !live.current.near) return;
      e.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // act reads everything else it needs from `live`
  }, [viewer]);

  if (hidden || (!seated && !near)) return null;

  return (
    <button type="button" className="seat-prompt" onClick={act}>
      <kbd>F</kbd>
      <span>{seated ? "Stand up" : "Sit"}</span>
      {!seated && <small>{near!.name}</small>}
    </button>
  );
}

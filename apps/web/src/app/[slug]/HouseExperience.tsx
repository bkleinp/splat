"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { readPose } from "@/components/tour/camera";
import { PlanControls, usePlanView } from "@/components/tour/PlanControls";
import { SeatPrompt } from "@/components/tour/SeatPrompt";
import { SplatViewer } from "@/components/tour/SplatViewer";
import { WalkLogger } from "@/components/tour/WalkLogger";
import type { Tour } from "@/lib/tours";
import { Chat } from "./Chat";

/**
 * The house page: the full-screen walk-through (with the Walk / Floor plan
 * switch) and the chat floating over it. Each question carries the camera pose
 * at the moment it's sent, so the answer knows where the visitor is and what
 * they're looking at; in the floor plan the camera is overhead, so questions go
 * without one and are answered about the whole home. The chat can be hidden;
 * it stays mounted so the conversation is kept.
 */
/** How far the visitor walks (meters) before the open chat starts folding away, and after how long. */
const WALK_AWAY_METRES = 0.3;
const AUTO_CLOSE_MS = 2000;

/** Dev-only walkthrough logger: whether to log floors, and whether to open it straight away. */
export type LoggerSetup = { floorStarts: number[]; unmapped: boolean };

export function HouseExperience({
  houseSlug,
  houseTitle,
  tourName,
  tour,
  sources,
  logger = null,
}: {
  houseSlug: string;
  houseTitle: string;
  /** The tour's file name (tours/<name>.json). */
  tourName: string;
  tour: Tour;
  sources: string[];
  logger?: LoggerSetup | null;
}) {
  // The chat starts as a small bubble in the corner, so the home is the first thing a visitor sees.
  const [chatOpen, setChatOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  // An answer coming in: the chat stays open while it does.
  const answeringRef = useRef(false);
  const onPendingChange = useCallback((pending: boolean) => {
    answeringRef.current = pending;
  }, []);
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const planView = usePlanView(viewer);
  // ?log opens the logger on a home that's already mapped (read after mount: the page is static)
  const [logParam, setLogParam] = useState(false);
  useEffect(() => setLogParam(new URLSearchParams(window.location.search).has("log")), []);

  // The viewer listens for WASD/arrow keys on the whole page, so typing in the
  // chat would also walk the camera. Pause its keyboard input while typing.
  const onTyping = (typing: boolean) => {
    if (viewerRef.current) viewerRef.current.state.inputEnabled = !typing;
  };

  const openChat = () => {
    setChatOpen(true);
    // Mouse and keyboard: ready to type. Touch screens: don't pop the keyboard over the home.
    if (window.matchMedia("(pointer: fine)").matches) {
      requestAnimationFrame(() => chatRef.current?.querySelector("input")?.focus());
    }
  };
  const closeChat = () => {
    onTyping(false);
    setChatOpen(false);
  };

  // Walking away folds the chat back into its pill: once the visitor moves (WASD, click to walk) while
  // not using the chat (pointer elsewhere, question box not focused), it closes after a moment unless
  // they come back to it. Looking around doesn't count, so "what's in front of me?" stays readable.
  useEffect(() => {
    if (!chatOpen || !viewer) return;
    let anchor: number[] | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inUse = () => !!chatRef.current?.matches(":hover, :focus-within") || answeringRef.current;
    const stopTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const watch = setInterval(() => {
      const pose = viewer.state.loaded ? readPose(viewer) : null;
      if (!pose) return;
      if (inUse() || !anchor) {
        // using the chat: measure walking from here
        anchor = pose.position;
        stopTimer();
        return;
      }
      const [x, , z] = pose.position;
      if (!timer && Math.hypot(x - anchor[0], z - anchor[2]) > WALK_AWAY_METRES) {
        timer = setTimeout(() => {
          timer = undefined;
          if (inUse()) return;
          onTyping(false);
          setChatOpen(false);
        }, AUTO_CLOSE_MS);
      }
    }, 150);
    return () => {
      clearInterval(watch);
      stopTimer();
    };
  }, [chatOpen, viewer]);

  const getPose = () =>
    viewerRef.current?.state.loaded && !planView.planRef.current ? readPose(viewerRef.current) : null;

  return (
    <div className="tour">
      <SplatViewer
        name={tourName}
        tour={tour}
        plan={planView.plan}
        onViewer={(v) => {
          viewerRef.current = v;
          setViewer(v);
        }}
      />

      <header className="tour-header">
        <Link href="/" className="tour-back">
          ← All homes
        </Link>
        <h1>{houseTitle}</h1>
      </header>

      {viewer && <PlanControls viewer={viewer} view={planView} />}
      {viewer && <SeatPrompt viewer={viewer} getSeats={() => tour.seats ?? []} hidden={planView.plan || chatOpen} />}

      {logger && (
        <WalkLogger
          viewer={viewer}
          houseSlug={houseSlug}
          floorStarts={logger.floorStarts}
          defaultOpen={logger.unmapped || logParam}
          onTyping={onTyping}
        />
      )}

      <div
        className="tour-chat"
        hidden={!chatOpen}
        ref={chatRef}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeChat();
        }}
      >
        <Chat
          houseSlug={houseSlug}
          houseTitle={houseTitle}
          sources={sources}
          getPose={getPose}
          onTyping={onTyping}
          showLocation={logger !== null}
          onClose={closeChat}
          onPendingChange={onPendingChange}
        />
      </div>
      {!chatOpen && (
        <button type="button" className="chat-bubble" onClick={openChat}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.4 1.2 4.5 3.2 5.9L5.5 21l4.3-2.6c.7.1 1.4.2 2.2.2 5.1 0 9-3.5 9-7.8S17.1 3 12 3z" />
          </svg>
          <span>Ask any question…</span>
        </button>
      )}
    </div>
  );
}

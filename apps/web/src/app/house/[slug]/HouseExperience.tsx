"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import type { Tour } from "@/lib/tours";
import { readPose } from "./camera";
import { Chat } from "./Chat";
import { PlanControls } from "./PlanControls";
import { SplatViewer } from "./SplatViewer";

/**
 * The house page: the full-screen walk-through (with the Walk / Floor plan
 * switch) and the chat floating over it. Each question carries the camera pose
 * at the moment it's sent, so the answer knows where the visitor is and what
 * they're looking at; in the floor plan the camera is overhead, so questions go
 * without one and are answered about the whole home. The chat can be hidden;
 * it stays mounted so the conversation is kept.
 */
export function HouseExperience({
  houseSlug,
  houseTitle,
  tour,
  sources,
}: {
  houseSlug: string;
  houseTitle: string;
  tour: Tour;
  sources: string[];
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const [plan, setPlan] = useState(false);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const planRef = useRef(false);

  // The viewer listens for WASD/arrow keys on the whole page, so typing in the
  // chat would also walk the camera. Pause its keyboard input while typing.
  const onTyping = (typing: boolean) => {
    if (viewerRef.current) viewerRef.current.state.inputEnabled = !typing;
  };

  const getPose = () =>
    viewerRef.current?.state.loaded && !planRef.current ? readPose(viewerRef.current) : null;

  return (
    <div className="tour">
      <SplatViewer
        tour={tour}
        plan={plan}
        onViewer={(v) => {
          viewerRef.current = v;
          setViewer(v);
          if (!v) {
            planRef.current = false;
            setPlan(false);
          }
        }}
      />

      <header className="tour-header">
        <Link href="/" className="tour-back">
          ← All homes
        </Link>
        <h1>{houseTitle}</h1>
      </header>

      {viewer && (
        <PlanControls
          viewer={viewer}
          plan={plan}
          onPlanChange={(on) => {
            planRef.current = on;
            setPlan(on);
          }}
        />
      )}

      <div className="tour-chat" hidden={!chatOpen}>
        <Chat
          houseSlug={houseSlug}
          houseTitle={houseTitle}
          sources={sources}
          getPose={getPose}
          onTyping={onTyping}
          onClose={() => {
            onTyping(false);
            setChatOpen(false);
          }}
        />
      </div>
      {!chatOpen && (
        <button type="button" className="tour-chat-open" onClick={() => setChatOpen(true)}>
          Ask about this home
        </button>
      )}
    </div>
  );
}

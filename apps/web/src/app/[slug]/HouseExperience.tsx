"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { readPose } from "@/components/tour/camera";
import { PlanControls, usePlanView } from "@/components/tour/PlanControls";
import { SeatPrompt } from "@/components/tour/SeatPrompt";
import { SplatViewer } from "@/components/tour/SplatViewer";
import type { Tour } from "@/lib/tours";
import { Chat } from "./Chat";

/**
 * The house page: the full-screen walk-through (with the Walk / Floor plan
 * switch) and the chat floating over it. Each question carries the camera pose
 * at the moment it's sent, so the answer knows where the visitor is and what
 * they're looking at; in the floor plan the camera is overhead, so questions go
 * without one and are answered about the whole home. The chat can be hidden;
 * it stays mounted so the conversation is kept. (The debug tools, the walkthrough
 * logger and the Position / Facing readout, are only on the settings page,
 * /<slug>/admin.)
 */

export function HouseExperience({
  houseSlug,
  houseTitle,
  tourName,
  tour,
  sources,
}: {
  houseSlug: string;
  houseTitle: string;
  /** The tour's file name (tours/<name>.json). */
  tourName: string;
  tour: Tour;
  sources: string[];
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const planView = usePlanView(viewer);

  // The viewer listens for WASD/arrow keys on the whole page, so typing in the
  // chat would also walk the camera. Pause its keyboard input while typing.
  const onTyping = (typing: boolean) => {
    if (viewerRef.current) viewerRef.current.state.inputEnabled = !typing;
  };

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
      {viewer && <SeatPrompt viewer={viewer} getSeats={() => tour.seats ?? []} hidden={planView.plan} />}

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

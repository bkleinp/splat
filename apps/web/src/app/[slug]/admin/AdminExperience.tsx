"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { readPose } from "@/components/tour/camera";
import { PlanControls, usePlanView } from "@/components/tour/PlanControls";
import { SeatPrompt } from "@/components/tour/SeatPrompt";
import { SplatViewer } from "@/components/tour/SplatViewer";
import { WalkLogger } from "@/components/tour/WalkLogger";
import type { Seat } from "@/lib/seats";
import type { Tour } from "@/lib/tours";
import { Chat } from "../Chat";
import type { PlanSwitch } from "./outline-editor";

/**
 * The settings page: the same walk-through as the house page with the settings
 * panel beside it. The panel is the tours app's imperative admin (admin.ts,
 * outline-editor.ts), mounted once the viewer exists. Over the walk-through sit
 * the home's debug tools: the chat with the Position / Facing readout, and the
 * walkthrough logger.
 */
export function AdminExperience({
  name,
  tour,
  openHref,
  house,
}: {
  name: string;
  tour: Tour;
  openHref: string | null;
  /** The home showing this tour, for the chat and the logger. */
  house: { slug: string; title: string; sources: string[]; floorStarts: number[] };
}) {
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const planView = usePlanView(viewer);
  const stageRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // The outline editor opens the floor plan itself (drawing, trim and haze only show there), so
  // hand it the switch, reading the latest state on every call.
  const planViewRef = useRef(planView);
  planViewRef.current = planView;

  // Typing in the chat or the logger shouldn't walk the camera.
  const onTyping = (typing: boolean) => {
    if (viewerRef.current) viewerRef.current.state.inputEnabled = !typing;
  };
  // As on the house page: the pose at the moment a question is sent; none in the floor plan.
  const getPose = () =>
    viewerRef.current?.state.loaded && !planView.planRef.current ? readPose(viewerRef.current) : null;

  // The draft's seats, kept current by the panel, so "Press F to sit" uses edits right away.
  const seatsRef = useRef<Seat[]>(tour.seats ?? []);

  useEffect(() => {
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!viewer || !stage || !panel) return;
    const planSwitch: PlanSwitch = {
      setPlan: (on) => planViewRef.current.setPlan(on),
      get plan() {
        return planViewRef.current.planRef.current;
      },
    };
    // admin.ts imports the viewer package (defaults), which touches window at import time: load it
    // in the browser only, like the viewer itself
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import("./admin").then(({ mountAdmin }) => {
      if (cancelled) return;
      try {
        unmount = mountAdmin(panel, name, tour, viewer, stage, planSwitch, openHref, (seats) => {
          seatsRef.current = seats;
        });
      } catch (err) {
        // The viewer can be torn down (React's dev double-mount, a hot reload) before this effect's
        // cleanup runs; the next viewer mounts its own panel, so only report other failures.
        if (!(err instanceof Error && /destroyed/.test(err.message))) throw err;
        panel.replaceChildren();
      }
    });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [viewer, name, tour, openHref]);

  return (
    <div className="admin-layout">
      <div className="admin-stage">
        <SplatViewer
          name={name}
          tour={tour}
          plan={planView.plan}
          onViewer={(v) => {
            viewerRef.current = v;
            setViewer(v);
          }}
          stageRef={stageRef}
          loadHiddenSkybox
        />
        {viewer && <PlanControls viewer={viewer} view={planView} />}
        {viewer && <SeatPrompt viewer={viewer} getSeats={() => seatsRef.current} hidden={planView.plan} />}

        <WalkLogger viewer={viewer} houseSlug={house.slug} floorStarts={house.floorStarts} defaultOpen onTyping={onTyping} />

        <div className="tour-chat" hidden={!chatOpen}>
          <Chat
            houseSlug={house.slug}
            houseTitle={house.title}
            sources={house.sources}
            getPose={getPose}
            onTyping={onTyping}
            showLocation
            onClose={() => {
              onTyping(false);
              setChatOpen(false);
            }}
          />
        </div>
        {!chatOpen && (
          <button type="button" className="chat-bubble" onClick={() => setChatOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.4 1.2 4.5 3.2 5.9L5.5 21l4.3-2.6c.7.1 1.4.2 2.2.2 5.1 0 9-3.5 9-7.8S17.1 3 12 3z" />
            </svg>
            <span>Ask any question…</span>
          </button>
        )}
      </div>
      <aside className="admin-panel" ref={panelRef} aria-label="Tour settings" />
    </div>
  );
}

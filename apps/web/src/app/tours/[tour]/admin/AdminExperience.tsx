"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { PlanControls, usePlanView } from "@/components/tour/PlanControls";
import { SplatViewer } from "@/components/tour/SplatViewer";
import type { Tour } from "@/lib/tours";
import type { PlanSwitch } from "./outline-editor";

/**
 * The settings page: the same walk-through as the house page (no chat) with
 * the settings panel beside it. The panel is the tours app's imperative admin
 * (admin.ts, outline-editor.ts), mounted once the viewer exists.
 */
export function AdminExperience({ name, tour, openHref }: { name: string; tour: Tour; openHref: string | null }) {
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const planView = usePlanView(viewer);
  const stageRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // The outline editor opens the floor plan itself (drawing, trim and haze only show there), so
  // hand it the switch, reading the latest state on every call.
  const planViewRef = useRef(planView);
  planViewRef.current = planView;

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
      if (!cancelled) unmount = mountAdmin(panel, name, tour, viewer, stage, planSwitch, openHref);
    });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [viewer, name, tour, openHref]);

  return (
    <div className="admin-layout">
      <div className="admin-stage">
        <SplatViewer tour={tour} plan={planView.plan} onViewer={setViewer} stageRef={stageRef} />
        {viewer && <PlanControls viewer={viewer} view={planView} />}
      </div>
      <aside className="admin-panel" ref={panelRef} aria-label="Tour settings" />
    </div>
  );
}

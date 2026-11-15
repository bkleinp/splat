"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import "@playcanvas/supersplat-viewer/viewer.css";
import type { Tour } from "@/lib/tours";

/**
 * The walk-through, set up the way the tours app does it (web/src/viewer.ts):
 * the viewer fork in walk-only mode with the tour's walk feel and floor plan
 * settings, built-in UI off. onViewer hands the live handle to the parent
 * (null on teardown) for the floor plan controls and the chat.
 */
export function SplatViewer({
  tour,
  plan,
  onViewer,
}: {
  tour: Tour;
  /** Whether the floor plan is showing (changes the hint). */
  plan: boolean;
  onViewer?: (viewer: ViewerHandle | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-creating the viewer when it changes.
  const onViewerRef = useRef(onViewer);
  onViewerRef.current = onViewer;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let created: ViewerHandle | null = null;
    let cancelled = false;

    (async () => {
      // The viewer touches window/WebGL at import time, so load it client-side only.
      const { createViewer } = await import("@playcanvas/supersplat-viewer/viewer");
      if (cancelled) return;
      const v = await createViewer({
        container,
        settings: structuredClone(tour.viewer),
        contentUrl: tour.content,
        collisionUrl: tour.collision ?? undefined,
        aa: tour.aa,
        ui: false,
        walkOnly: true,
        walk: tour.walk,
      });
      if (cancelled) {
        v.destroy();
        return;
      }
      v.setPlanOutline(tour.plan?.outline ?? null);
      v.setPlanBottom(tour.plan?.bottom ?? null);
      if (tour.plan?.cleanup) v.setPlanCleanup(tour.plan.cleanup);

      created = v;
      setProgress(v.state.progress);
      setLoaded(v.state.loaded);
      v.events.on("progress:changed", (p: number) => setProgress(p));
      v.events.on("loaded:changed", (l: boolean) => setLoaded(l));
      onViewerRef.current?.(v);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "The 3D tour couldn't load.");
    });

    return () => {
      cancelled = true;
      // Browsers cap live WebGL contexts (~16), so every mount must be torn down.
      created?.destroy();
      onViewerRef.current?.(null);
    };
  }, [tour]);

  return (
    <section className="scene" aria-label="3D tour">
      <div ref={containerRef} className="scene-canvas" />

      {!loaded && !error && (
        <div className="scene-loading">
          <span>Loading 3D tour… {Math.round(progress)}%</span>
          <div className="scene-progress">
            <div style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
          </div>
        </div>
      )}
      {error && <div className="scene-loading scene-error">{error}</div>}

      {loaded && (
        <div className="scene-bottom">
          <span className="scene-hint">
            {plan
              ? "Drag to tilt and turn · scroll or pinch to zoom"
              : "Click a spot to walk there · drag to look · WASD to move"}
          </span>
          {tour.credit && <span className="scene-credit">{tour.credit}</span>}
        </div>
      )}
    </section>
  );
}

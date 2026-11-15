"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import "@playcanvas/supersplat-viewer/viewer.css";
import { skyboxSrc } from "@/lib/skybox";
import type { Tour } from "@/lib/tours";

/**
 * The walk-through: the viewer fork (engine/supersplat-viewer) in walk-only
 * mode with the tour's walk feel and floor plan settings, built-in UI off.
 * onViewer hands the live handle to the parent (null on teardown) for the
 * floor plan controls, the chat and the settings panel; stageRef is the
 * element the viewer fills, for overlays (the outline editor draws on it).
 */
export function SplatViewer({
  name,
  tour,
  plan,
  onViewer,
  stageRef,
  loadHiddenSkybox = false,
}: {
  /** The tour's file name (tours/<name>.json), for its skybox url. */
  name: string;
  tour: Tour;
  /**
   * Load the skybox even when the tour has it switched off (hidden), so it can be switched on live:
   * the settings page. Otherwise a hidden skybox isn't downloaded at all.
   */
  loadHiddenSkybox?: boolean;
  /** Whether the floor plan is showing (changes the hint). */
  plan: boolean;
  onViewer?: (viewer: ViewerHandle | null) => void;
  stageRef?: React.Ref<HTMLElement>;
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
      const showSkybox = tour.showSkybox !== false;
      const v = await createViewer({
        container,
        settings: structuredClone(tour.viewer),
        contentUrl: tour.content,
        collisionUrl: tour.collision ?? undefined,
        skyboxUrl: showSkybox || loadHiddenSkybox ? skyboxSrc(name, tour) : undefined,
        aa: tour.aa,
        ui: false,
        walkOnly: true,
        walk: tour.walk,
      });
      if (cancelled) {
        v.destroy();
        return;
      }
      v.setSkyboxVisible(showSkybox);
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
  }, [name, tour, loadHiddenSkybox]);

  return (
    <section className="scene" aria-label="3D tour" ref={stageRef}>
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
              ? "Drag to turn · Scroll to zoom"
              : "Click to walk · Drag to look · WASD to move"}
          </span>
        </div>
      )}
    </section>
  );
}

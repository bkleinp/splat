"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import "@playcanvas/supersplat-viewer/viewer.css";

export type SceneProps = {
  contentUrl: string;
  settingsUrl: string;
  collisionUrl?: string;
  aa?: boolean;
  credit: string;
};

/**
 * Full-screen 3D tour on engine/supersplat-viewer, built-in UI off
 * (engine/README.md). The tour is walk-only: the viewer is put in walk mode
 * once the scene and its collision are ready, and put back if anything (e.g.
 * the viewer's 1/2/3/Esc shortcuts) switches it to orbit or fly. onViewer hands
 * the live handle to the parent (null on teardown).
 */
export function SplatViewer({
  scene,
  onViewer,
}: {
  scene: SceneProps;
  onViewer?: (viewer: ViewerHandle | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<ViewerHandle | null>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [walkAllowed, setWalkAllowed] = useState(false);
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
        ui: false,
        settings: scene.settingsUrl,
        contentUrl: scene.contentUrl,
        collisionUrl: scene.collisionUrl,
        aa: scene.aa,
      });
      if (cancelled) {
        v.destroy();
        return;
      }
      created = v;

      // Walk is the only mode. Writing cameraMode directly is the documented
      // way to enter walk; deferred so we never write state inside its own
      // change event.
      const keepWalking = () =>
        queueMicrotask(() => {
          if (!cancelled && v.state.loaded && v.state.walkAllowed && v.state.cameraMode !== "walk") {
            v.state.cameraMode = "walk";
          }
        });

      setViewer(v);
      setProgress(v.state.progress);
      setLoaded(v.state.loaded);
      setWalkAllowed(v.state.walkAllowed);
      v.events.on("progress:changed", (p: number) => setProgress(p));
      v.events.on("loaded:changed", (l: boolean) => {
        setLoaded(l);
        keepWalking();
      });
      v.events.on("walkAllowed:changed", (w: boolean) => {
        setWalkAllowed(w);
        keepWalking();
      });
      v.events.on("cameraMode:changed", keepWalking);
      keepWalking();
      onViewerRef.current?.(v);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "The 3D tour couldn't load.");
    });

    return () => {
      cancelled = true;
      // Browsers cap live WebGL contexts (~16), so every mount must be torn down.
      created?.destroy();
      setViewer(null);
      onViewerRef.current?.(null);
    };
  }, [scene.contentUrl, scene.settingsUrl, scene.collisionUrl, scene.aa]);

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
          <div className="scene-controls" role="toolbar" aria-label="Camera">
            {/* resetCamera keeps walk mode and returns to where walking started. */}
            <button type="button" onClick={() => viewer?.resetCamera()}>
              Reset position
            </button>
          </div>
          <span className="scene-hint">
            {walkAllowed
              ? "Click a spot to walk there · drag to look · WASD to move"
              : "Walking isn't available for this scene · drag to look around"}
          </span>
          <span className="scene-credit">{scene.credit}</span>
        </div>
      )}
    </section>
  );
}

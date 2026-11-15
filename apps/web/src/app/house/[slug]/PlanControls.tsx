"use client";

import { useEffect, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";

// The bar at the top of a tour: a Walk / Floor plan switch, and in the floor plan a slider that
// cuts the walls down to see into the rooms from above. A React port of the tours app's
// web/src/plan-controls.ts: keep the two in step.

/** Wall height shown when the floor plan opens, meters above the floor. */
const DEFAULT_CUT = 1.3;
/** Lowest cut the slider offers: below this the floor itself starts to disappear. */
const MIN_CUT = 0.2;
/** Highest cut the slider offers; at the top of its range nothing is cut. */
const MAX_CUT = 4;

const formatCut = (value: number, max: number) => (value >= max ? "Full" : `${value.toFixed(1)} m`);

export function PlanControls({
  viewer,
  plan,
  onPlanChange,
}: {
  viewer: ViewerHandle;
  plan: boolean;
  onPlanChange: (plan: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(viewer.state.loaded);
  const [cut, setCut] = useState(DEFAULT_CUT);
  const [max, setMax] = useState(MAX_CUT);

  useEffect(() => {
    if (viewer.state.loaded) return setLoaded(true);
    const handle = viewer.events.once("loaded:changed", () => setLoaded(true));
    return () => handle.off();
  }, [viewer]);

  const applyCut = (on: boolean, value: number, top: number) => viewer.setCutHeight(on && value < top ? value : null);

  const setPlan = (on: boolean) => {
    if (on === plan || !viewer.state.loaded) return;
    viewer.setPlanView(on);
    let top = max;
    let value = cut;
    if (on) {
      // the slider spans the height of the scene above this floor, up to MAX_CUT
      const info = viewer.getPlanInfo();
      top = Math.max(MIN_CUT + 0.5, Math.min(MAX_CUT, Math.round(info.height * 10) / 10));
      value = Math.min(cut, top);
      setMax(top);
      setCut(value);
    }
    applyCut(on, value, top);
    onPlanChange(on);
  };

  if (!loaded) return null;

  return (
    <div
      className={`plan-bar${plan ? " is-plan" : ""}`}
      // keep the viewer's keyboard controls off while these controls have focus (arrow keys on
      // the slider would otherwise also move the camera)
      onFocus={() => (viewer.state.inputEnabled = false)}
      onBlur={() => (viewer.state.inputEnabled = true)}
    >
      <div className="view-switch" role="group" aria-label="View">
        <span className="thumb" aria-hidden="true" />
        <button type="button" aria-pressed={!plan} onClick={() => setPlan(false)}>
          Walk
        </button>
        <button type="button" aria-pressed={plan} onClick={() => setPlan(true)}>
          Floor plan
        </button>
      </div>
      {plan && (
        <label className="cut">
          <span className="cut-label">Walls</span>
          <input
            type="range"
            aria-label="Wall height"
            min={MIN_CUT}
            max={max}
            step={0.05}
            value={cut}
            style={{ ["--fill" as string]: `${((cut - MIN_CUT) / (max - MIN_CUT)) * 100}%` }}
            onChange={(e) => {
              const value = Number(e.target.value);
              setCut(value);
              applyCut(true, value, max);
            }}
          />
          <output className="cut-value">{formatCut(cut, max)}</output>
        </label>
      )}
    </div>
  );
}

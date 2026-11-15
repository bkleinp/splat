"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";

// The Walk / Floor plan switch, and in the floor plan a slider that cuts the walls down to see
// into the rooms from above. (Originally the tours app's plan-controls.ts.) The state lives in
// usePlanView so the settings page's outline editor can open the floor plan too.

/** Wall height shown when the floor plan opens, meters above the floor. */
const DEFAULT_CUT = 1.3;
/** Lowest cut the slider offers: below this the floor itself starts to disappear. */
const MIN_CUT = 0.2;
/** Highest cut the slider offers; at the top of its range nothing is cut. */
const MAX_CUT = 4;

const formatCut = (value: number, max: number) => (value >= max ? "Full" : `${value.toFixed(1)} m`);

export type PlanView = {
  /** Whether the floor plan is showing. */
  plan: boolean;
  /** Same, readable from callbacks without re-rendering. */
  planRef: React.RefObject<boolean>;
  /** Open or close the floor plan, as the switch does. */
  setPlan: (on: boolean) => void;
  /** Wall cut, meters above the floor, and the slider's top (at the top nothing is cut). */
  cut: number;
  max: number;
  setCut: (value: number) => void;
  /** The scene has loaded, so the floor plan can open. */
  ready: boolean;
};

export function usePlanView(viewer: ViewerHandle | null): PlanView {
  const [plan, setPlanState] = useState(false);
  const [cut, setCutState] = useState(DEFAULT_CUT);
  const [max, setMax] = useState(MAX_CUT);
  const [ready, setReady] = useState(false);
  const planRef = useRef(false);
  const cutRef = useRef(DEFAULT_CUT);
  const maxRef = useRef(MAX_CUT);

  const applyCut = useCallback(() => {
    viewer?.setCutHeight(planRef.current && cutRef.current < maxRef.current ? cutRef.current : null);
  }, [viewer]);

  useEffect(() => {
    planRef.current = false;
    setPlanState(false);
    if (!viewer) return setReady(false);
    setReady(viewer.state.loaded);
    const loaded = viewer.events.on("loaded:changed", (l: boolean) => setReady(l));
    // the viewer can leave the floor plan on its own (or another control can move it): follow it
    const planChanged = viewer.events.on("planView:changed", (on: boolean) => {
      planRef.current = on;
      setPlanState(on);
    });
    return () => {
      loaded.off();
      planChanged.off();
    };
  }, [viewer]);

  const setPlan = useCallback(
    (on: boolean) => {
      if (!viewer || on === planRef.current || !viewer.state.loaded) return;
      planRef.current = on;
      viewer.setPlanView(on);
      if (on) {
        // the slider spans the height of the scene above this floor, up to MAX_CUT
        const info = viewer.getPlanInfo();
        maxRef.current = Math.max(MIN_CUT + 0.5, Math.min(MAX_CUT, Math.round(info.height * 10) / 10));
        cutRef.current = Math.min(cutRef.current, maxRef.current);
        setMax(maxRef.current);
        setCutState(cutRef.current);
      }
      applyCut();
      setPlanState(on);
    },
    [viewer, applyCut],
  );

  const setCut = useCallback(
    (value: number) => {
      cutRef.current = value;
      setCutState(value);
      applyCut();
    },
    [applyCut],
  );

  return { plan, planRef, setPlan, cut, max, setCut, ready };
}

export function PlanControls({ viewer, view }: { viewer: ViewerHandle; view: PlanView }) {
  const { plan, setPlan, cut, max, setCut, ready } = view;
  if (!ready) return null;

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
            onChange={(e) => setCut(Number(e.target.value))}
          />
          <output className="cut-value">{formatCut(cut, max)}</output>
        </label>
      )}
    </div>
  );
}

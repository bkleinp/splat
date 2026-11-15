import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import type { Pose } from "@splat/llm/spatial";

/** The viewer camera's pose. The viewer has no pose API yet, so this reads the engine entity it creates. */
export function readPose(viewer: ViewerHandle): Pose | null {
  const camera = viewer.app.root.findByName("camera");
  if (!camera) return null;
  const p = camera.getPosition();
  const f = camera.forward;
  return { position: [p.x, p.y, p.z], forward: [f.x, f.y, f.z] };
}

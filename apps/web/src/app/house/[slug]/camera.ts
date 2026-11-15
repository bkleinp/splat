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

/**
 * Heading on the floor plan, degrees: 0 = facing +z, 90 = +x, 180 = -z, -90 = -x.
 * Same x/z axes the zone boxes in llm/src/houses.ts use.
 */
export function heading(pose: Pose): number {
  return (Math.atan2(pose.forward?.[0] ?? 0, pose.forward?.[2] ?? 1) * 180) / Math.PI;
}

/** Camera tilt, degrees: positive = looking up, negative = looking down, 0 = level. */
export function pitch(pose: Pose): number {
  const [fx, fy, fz] = pose.forward ?? [0, 0, 1];
  return (Math.atan2(fy, Math.hypot(fx, fz)) * 180) / Math.PI;
}

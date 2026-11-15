/**
 * Places to sit in a tour (chairs, couches). A visitor who walks up to one sees "Press F to sit";
 * sitting glides the camera to the seat, where they can look around until they move or press F
 * again. Seats are stored in the tour file and edited on the settings page.
 */
export type Seat = {
  id: string;
  /** Shown in the prompt: "Press F to sit on the <name>". */
  name: string;
  /** Seated eye position, world space [x, y, z]. */
  position: [number, number, number];
  /** Direction the seat faces, degrees, in the viewer's heading convention (0 looks down -z). */
  yaw: number;
};

/** How close (horizontally, meters) a visitor must be to a seat to be offered it. */
export const SEAT_REACH = 1.6;

/** A seat this far ahead or more must also be roughly in front of the visitor. */
const NEAR = 0.7;

/** How far off to the side (degrees from straight ahead) a seat can be and still be offered. */
const MAX_ANGLE = 70;

/** The viewer's heading for a horizontal direction: 0 looks down -z, 90 down -x. */
export const yawOf = (x: number, z: number) => (Math.atan2(-x, -z) * 180) / Math.PI;

/** The horizontal unit direction a heading looks along. */
export const dirOf = (yaw: number): [number, number] => {
  const r = (yaw * Math.PI) / 180;
  return [-Math.sin(r), -Math.cos(r)];
};

/**
 * The seat to offer a visitor standing at `position`, looking along `forward`: the nearest one
 * within reach that's in front of them (or right beside them). Null when there's none.
 */
export function seatInReach(
  seats: readonly Seat[],
  position: readonly number[],
  forward: readonly number[],
): Seat | null {
  const flen = Math.hypot(forward[0], forward[2]) || 1;
  const fx = forward[0] / flen;
  const fz = forward[2] / flen;
  let best: Seat | null = null;
  let bestDist = Infinity;
  for (const seat of seats) {
    const dx = seat.position[0] - position[0];
    const dz = seat.position[2] - position[2];
    const dist = Math.hypot(dx, dz);
    if (dist > SEAT_REACH || dist >= bestDist) continue;
    if (dist > NEAR) {
      const angle = (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / dist))) * 180) / Math.PI;
      if (angle > MAX_ANGLE) continue;
    }
    best = seat;
    bestDist = dist;
  }
  return best;
}

import type { Box, House, Vec3, Zone, ZoneKind } from "./types";

// Spatial resolution service (blueprint § "Spatial Resolution Service").
// Location is deterministic app logic: the model only ever sees the resolved,
// named result, never raw coordinates. Two independent answers:
//   where you are   = the room (or doorway) containing the camera's x/z position
//   what you're facing = the first object box the camera's 3D view ray hits

/** The viewer camera, in the scene's world coordinates (blueprint scene.pose.v1). */
export type Pose = { position: Vec3; forward?: Vec3 };

export type ZoneRef = { id: string; name: string; kind: ZoneKind };

export type ResolvedLocation = {
  /** Where you're standing: the entrance whose doorway you're in, else the room. */
  primaryZone?: ZoneRef;
  /** Containing zones, innermost first (an entrance's room). */
  ancestorZones: ZoneRef[];
  /** The object you're facing, what "this" most likely means. */
  facingZone?: ZoneRef;
  /**
   * How facingZone was found: "ray" = the view ray hits it; "nearest" = the ray
   * hits nothing, so it's the object closest to where you're standing.
   */
  facingBy?: "ray" | "nearest";
  /** Other objects in view or within reach, nearest first (blueprint: nearbyZones). */
  nearbyZones: ZoneRef[];
  confidence: number;
  resolution: "inside-zone" | "near-zone" | "unknown";
};

const NEAR_ROOM_METRES = 1.5; // outside every room box: still "near" a room within this
const VIEW_METRES = 8; // how far the view ray reaches (the open-plan middle is ~7 m long)
const SAME_HIT_METRES = 0.15; // two boxes hit this close together: the smaller (more specific) wins
const NEAREST_METRES = 2.5; // ray hits nothing: fall back to the closest object within this
const REACH_METRES = 1.0; // objects this close count as nearby whichever way you face
const CONE_COS = Math.cos((35 * Math.PI) / 180); // half-angle of the "in view" cone

const UNKNOWN: ResolvedLocation = { ancestorZones: [], nearbyZones: [], confidence: 0, resolution: "unknown" };

const ref = (zone: Zone): ZoneRef => ({ id: zone.id, name: zone.name, kind: zone.kind });
const isRoom = (z: Zone) => z.kind === "room" || z.kind === "outdoor_area";

/** Room and doorway boxes are matched on the floor plan: where you stand, not how tall you are. */
const containsXZ = (b: Box, [x, , z]: Vec3) => x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2];

/** Floor area (x/z) of a box. */
const footprint = (b: Box) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);

/** Horizontal distance from a point to a box (0 inside its footprint). */
function distanceToBox(b: Box, [x, , z]: Vec3): number {
  const dx = Math.max(b.min[0] - x, 0, x - b.max[0]);
  const dz = Math.max(b.min[2] - z, 0, z - b.max[2]);
  return Math.hypot(dx, dz);
}

/**
 * Distance along a 3D ray (unit direction) to where it enters a box, by the
 * slab method, or null if it misses. A ray starting inside the box hits at 0.
 */
function rayHit(b: Box, origin: Vec3, dir: Vec3): number | null {
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    if (Math.abs(d) < 1e-9) {
      if (o < b.min[i] || o > b.max[i]) return null;
    } else {
      const a = (b.min[i] - o) / d;
      const c = (b.max[i] - o) / d;
      t0 = Math.max(t0, Math.min(a, c));
      t1 = Math.min(t1, Math.max(a, c));
    }
  }
  return t0 <= t1 ? t0 : null;
}

function unit(v: Vec3 | undefined): Vec3 | null {
  if (!v) return null;
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-9 ? null : [v[0] / l, v[1] / l, v[2] / l];
}

/** Cosine of the horizontal angle from the heading to a box's nearest point (1 = dead ahead). */
function inCone(b: Box, [x, , z]: Vec3, dir: Vec3): number {
  const fl = Math.hypot(dir[0], dir[2]);
  if (fl < 1e-6) return 0;
  const px = Math.min(Math.max(x, b.min[0]), b.max[0]) - x;
  const pz = Math.min(Math.max(z, b.min[2]), b.max[2]) - z;
  const l = Math.hypot(px, pz);
  return l < 1e-6 ? 1 : (px * dir[0] + pz * dir[2]) / (l * fl);
}

/** The room a zone is in (itself, for a room). */
function roomOf(zone: Zone, byId: Map<string, Zone>): Zone | undefined {
  for (let z: Zone | undefined = zone; z; z = z.parentId ? byId.get(z.parentId) : undefined) {
    if (isRoom(z)) return z;
  }
  return undefined;
}

/** Rooms you can see from inside `room`: itself plus open connections in either direction. */
function visibleRoomIds(room: Zone, zones: Zone[]): Set<string> {
  const ids = new Set([room.id, ...(room.opensTo ?? [])]);
  for (const z of zones) if (z.opensTo?.includes(room.id)) ids.add(z.id);
  return ids;
}

function ancestorsOf(zone: Zone, byId: Map<string, Zone>): ZoneRef[] {
  const out: ZoneRef[] = [];
  for (let z = zone.parentId ? byId.get(zone.parentId) : undefined; z; z = z.parentId ? byId.get(z.parentId) : undefined) {
    if (z.kind !== "property") out.push(ref(z));
  }
  return out;
}

const smallestContaining = (zones: Zone[], position: Vec3) =>
  zones
    .flatMap((zone) => (zone.boxes ?? []).filter((b) => containsXZ(b, position)).map((box) => ({ zone, box })))
    .sort((a, b) => footprint(a.box) - footprint(b.box))[0]?.zone;

/**
 * Resolve a camera pose to a named location.
 * 1. Where you are, from x/z: the entrance whose doorway box you're in, else
 *    the smallest room box containing you, else the nearest room within
 *    NEAR_ROOM_METRES ("near"), else "unknown" (never guess further).
 * 2. What you're facing: cast the camera's 3D view ray (heading and tilt)
 *    against the object boxes in rooms visible from yours (opensTo), and take
 *    the first hit. Two hits within SAME_HIT_METRES: the smaller box wins, so
 *    the sink beats the counter it's set into.
 * 3. If the ray hits nothing (looking at a bare wall, the ceiling, the floor),
 *    the object closest to where you're standing, preferring your own room.
 * 4. Nearby: other objects within reach, or in a ±35° cone within view range.
 */
export function resolvePose(house: House, pose: Pose | undefined): ResolvedLocation {
  if (!pose) return UNKNOWN;
  const { position } = pose;
  const dir = unit(pose.forward);
  const byId = new Map(house.zones.map((z) => [z.id, z]));

  // 1. Where you are.
  const rooms = house.zones.filter((z) => isRoom(z) && z.boxes?.length);
  let room = smallestContaining(rooms, position);
  let resolution: ResolvedLocation["resolution"] = "inside-zone";
  let confidence = 0.9;
  if (!room) {
    const nearest = rooms
      .map((zone) => ({ zone, d: Math.min(...zone.boxes!.map((b) => distanceToBox(b, position))) }))
      .filter((r) => r.d <= NEAR_ROOM_METRES)
      .sort((a, b) => a.d - b.d)[0];
    if (!nearest) return UNKNOWN;
    room = nearest.zone;
    resolution = "near-zone";
    confidence = 0.5;
  }
  const entrance = smallestContaining(house.zones.filter((z) => z.kind === "entrance"), position);
  const primary = entrance ?? room;
  const ancestorZones = ancestorsOf(primary, byId);

  const visible = visibleRoomIds(room, house.zones);
  const objects = house.zones.filter((z) => {
    if (!z.target?.length) return false;
    const r = roomOf(z, byId);
    return r !== undefined && visible.has(r.id);
  });

  // 2. What the view ray hits first.
  type Hit = { zone: Zone; t: number; area: number };
  let hit: Hit | undefined;
  if (dir) {
    for (const zone of objects) {
      for (const box of zone.target!) {
        const t = rayHit(box, position, dir);
        if (t === null || t > VIEW_METRES) continue;
        const area = footprint(box);
        if (!hit || t < hit.t - SAME_HIT_METRES || (Math.abs(t - hit.t) <= SAME_HIT_METRES && area < hit.area)) {
          hit = { zone, t, area };
        }
      }
    }
  }

  // 3. Nothing hit: the closest object to where you're standing (your room's first).
  let facing = hit?.zone;
  let facingBy: ResolvedLocation["facingBy"] = hit ? "ray" : undefined;
  if (!facing) {
    const closest = objects
      .map((zone) => ({
        zone,
        d: Math.min(...zone.target!.map((b) => distanceToBox(b, position))),
        mine: roomOf(zone, byId)?.id === room.id,
      }))
      .filter((c) => c.d <= NEAREST_METRES)
      .sort((a, b) => Number(b.mine) - Number(a.mine) || a.d - b.d)[0];
    if (closest) {
      facing = closest.zone;
      facingBy = "nearest";
    }
  }

  // 4. Nearby.
  const exclude = new Set([primary.id, room.id, facing?.id, ...ancestorZones.map((z) => z.id)]);
  const nearbyZones = objects
    .filter((zone) => !exclude.has(zone.id))
    .map((zone) => ({
      zone,
      d: Math.min(...zone.target!.map((b) => distanceToBox(b, position))),
      ahead: dir ? Math.max(...zone.target!.map((b) => inCone(b, position, dir))) >= CONE_COS : false,
    }))
    .filter((c) => c.d <= REACH_METRES || (c.ahead && c.d <= VIEW_METRES))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map((c) => ref(c.zone));

  return {
    primaryZone: ref(primary),
    ancestorZones,
    facingZone: facing ? ref(facing) : undefined,
    facingBy,
    nearbyZones,
    confidence,
    resolution,
  };
}

/**
 * How relevant each zone is to the visitor's current location, 0–1. Used to
 * rank document sections (blueprint § "Retrieval ranking": zone_match).
 *   1.0  the object they're facing
 *   0.9  the zone they're in (room or entrance), or anything else inside it
 *   0.8  a containing zone (an entrance's room)
 *   0.7  objects in view or within reach
 */
export function zoneRelevance(house: House, location: ResolvedLocation): Map<string, number> {
  const scores = new Map<string, number>();
  const primaryId = location.primaryZone?.id;
  if (!primaryId) return scores;

  const set = (id: string, score: number) => scores.set(id, Math.max(scores.get(id) ?? 0, score));
  const byId = new Map(house.zones.map((z) => [z.id, z]));
  const isInside = (zone: Zone, ancestorId: string): boolean => {
    for (let z: Zone | undefined = zone; z; z = z.parentId ? byId.get(z.parentId) : undefined) {
      if (z.id === ancestorId) return true;
    }
    return false;
  };

  for (const zone of house.zones) {
    if (isInside(zone, primaryId)) set(zone.id, 0.9);
  }
  if (location.facingZone) set(location.facingZone.id, 1);
  for (const z of location.ancestorZones) set(z.id, 0.8);
  for (const z of location.nearbyZones) set(z.id, 0.7);
  return scores;
}

/**
 * Short label for the UI: where you are → what you're facing.
 * "Kitchen → Sink", "Second bathroom · Entrance → Shower", or "Living room · near Couch"
 * when the view ray hits nothing and the closest object stands in.
 */
export function locationLabel(location: ResolvedLocation): string | undefined {
  const { primaryZone, ancestorZones, facingZone, facingBy } = location;
  if (!primaryZone) return undefined;
  const room = ancestorZones.find((z) => z.kind === "room" || z.kind === "outdoor_area");
  const where = room ? `${room.name} · ${primaryZone.name}` : primaryZone.name;
  if (!facingZone) return where;
  return facingBy === "nearest" ? `${where} · near ${facingZone.name}` : `${where} → ${facingZone.name}`;
}

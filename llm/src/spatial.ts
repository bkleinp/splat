import type { Box, House, Vec3, Zone, ZoneKind } from "./types";

// Spatial resolution service (blueprint § "Spatial Resolution Service").
// The geometry is deterministic app logic; deciding what "this" means is not.
// This module measures, for the camera pose sent with a question:
//   where you are   = the room (or doorway) containing the camera's position:
//                     its x/z on the floor plan, and its height for the storey
//   how you look    = the camera's tilt
//   line of sight   = every object box the 3D view ray passes through, in order
//   around you      = objects nearby, with distance and direction
// and the model weighs those against the question's wording to decide what
// the visitor is asking about (see the location rules in context.ts). The
// model never sees raw coordinates.

/** The viewer camera, in the scene's world coordinates (blueprint scene.pose.v1). */
export type Pose = { position: Vec3; forward?: Vec3 };

export type ZoneRef = { id: string; name: string; kind: ZoneKind };

/** Where an object is relative to the way the visitor faces (on the floor plan). */
export type Bearing = "ahead" | "ahead-left" | "ahead-right" | "left" | "right" | "behind-left" | "behind-right" | "behind";

/** `room` is the object's room; `inRoom` = the same room the visitor is standing in. */
export type RayHit = { zone: ZoneRef; room?: string; inRoom: boolean; metres: number };
export type NearbyObject = { zone: ZoneRef; room?: string; inRoom: boolean; metres: number; bearing: Bearing };

export type ResolvedLocation = {
  /** Where you're standing: the entrance whose doorway you're in, else the room. */
  primaryZone?: ZoneRef;
  /** Containing zones, innermost first (an entrance's room). */
  ancestorZones: ZoneRef[];
  /** Camera tilt, degrees: positive = looking up. Undefined if no direction was sent. */
  pitch?: number;
  /** Objects the view ray passes through, nearest first, with distance along the ray. */
  rayHits: RayHit[];
  /** Objects around the visitor (visible rooms), nearest first. */
  nearbyObjects: NearbyObject[];
  confidence: number;
  resolution: "inside-zone" | "near-zone" | "unknown";
};

const NEAR_ROOM_METRES = 1.5; // outside every room box: still "near" a room within this
const VIEW_METRES = 8; // how far the view ray reaches (the open-plan middle is ~7 m long)
const NEARBY_METRES = 3; // objects within this count as "around you"
const DOORWAY_TOUCH_METRES = 0.1; // a room box this close to a doorway box is on one side of it
const MAX_RAY_HITS = 4;
const MAX_NEARBY = 6;

const UNKNOWN: ResolvedLocation = { ancestorZones: [], rayHits: [], nearbyObjects: [], confidence: 0, resolution: "unknown" };

const ref = (zone: Zone): ZoneRef => ({ id: zone.id, name: zone.name, kind: zone.kind });
const isRoom = (z: Zone) => z.kind === "room" || z.kind === "outdoor_area";

/**
 * Room and doorway boxes are matched on the floor plan (where you stand), and
 * on height only to tell storeys apart: a room box spans its storey's whole
 * camera-height range (one-storey homes use one range for everything).
 */
const contains = (b: Box, [x, y, z]: Vec3) =>
  x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && y >= b.min[1] && y <= b.max[1];

/** The camera is at this box's storey (its height range). */
const onStorey = (b: Box, [, y]: Vec3) => y >= b.min[1] && y <= b.max[1];

/** Floor area (x/z) of a box. */
const footprint = (b: Box) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);

/** Horizontal gap between two boxes' footprints (0 if they touch or overlap); Infinity on different storeys. */
function boxGap(a: Box, b: Box): number {
  if (a.min[1] >= b.max[1] || b.min[1] >= a.max[1]) return Infinity;
  const dx = Math.max(a.min[0] - b.max[0], 0, b.min[0] - a.max[0]);
  const dz = Math.max(a.min[2] - b.max[2], 0, b.min[2] - a.max[2]);
  return Math.hypot(dx, dz);
}

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

/**
 * Which way a box lies from where you stand, relative to your heading, on the
 * floor plan. In this scene's axes, facing +z puts +x on your left.
 */
function bearingTo(b: Box, [x, , z]: Vec3, dir: Vec3 | null): Bearing {
  const fl = dir ? Math.hypot(dir[0], dir[2]) : 0;
  const px = Math.min(Math.max(x, b.min[0]), b.max[0]) - x;
  const pz = Math.min(Math.max(z, b.min[2]), b.max[2]) - z;
  const l = Math.hypot(px, pz);
  if (!dir || fl < 1e-6 || l < 1e-6) return "ahead"; // standing over it, or no heading
  const fx = dir[0] / fl;
  const fz = dir[2] / fl;
  const angle = (Math.acos(Math.max(-1, Math.min(1, (px * fx + pz * fz) / l))) * 180) / Math.PI;
  const left = fx * pz - fz * px < 0;
  if (angle <= 30) return "ahead";
  if (angle <= 75) return left ? "ahead-left" : "ahead-right";
  if (angle <= 115) return left ? "left" : "right";
  if (angle <= 155) return left ? "behind-left" : "behind-right";
  return "behind";
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
    .flatMap((zone) => (zone.boxes ?? []).filter((b) => contains(b, position)).map((box) => ({ zone, box })))
    .sort((a, b) => footprint(a.box) - footprint(b.box))[0]?.zone;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Measure a camera pose against the house's zones.
 * 1. Where you are, from x/z (and height, for the storey): the entrance whose
 *    doorway box you're in, else the smallest room box containing you, else
 *    the nearest room on your storey within NEAR_ROOM_METRES ("near"), else
 *    the storey itself (a floor zone with a box, for multi-storey homes whose
 *    rooms aren't mapped there yet), else "unknown" (never guess further).
 * 2. Line of sight: every object box (in rooms visible from where you stand:
 *    your room, its open-plan neighbours via opensTo, and from a doorway the
 *    rooms on both sides) that the 3D view ray passes through within
 *    VIEW_METRES, nearest first, with distance along the ray.
 * 3. Around you: objects within NEARBY_METRES, nearest first, with bearing
 *    (ahead, left, behind…) and whether they're in your own room.
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
      .map((zone) => ({ zone, d: Math.min(Infinity, ...zone.boxes!.filter((b) => onStorey(b, position)).map((b) => distanceToBox(b, position))) }))
      .filter((r) => r.d <= NEAR_ROOM_METRES)
      .sort((a, b) => a.d - b.d)[0];
    if (nearest) {
      room = nearest.zone;
      resolution = "near-zone";
      confidence = 0.5;
    }
  }
  if (!room) {
    // Somewhere on a storey with no mapped room here (a landing, the stairs, an unmapped room):
    // say which floor, and nothing finer.
    const floor = smallestContaining(house.zones.filter((z) => z.kind === "floor"), position);
    if (!floor) return UNKNOWN;
    return { ...UNKNOWN, primaryZone: ref(floor), ancestorZones: ancestorsOf(floor, byId), confidence: 0.6, resolution: "inside-zone" };
  }
  const entrance = smallestContaining(house.zones.filter((z) => z.kind === "entrance"), position);
  if (entrance && resolution === "near-zone") {
    // Standing in a doorway box is a definite place, even where it pokes past the room boxes.
    resolution = "inside-zone";
    confidence = 0.9;
  }
  const primary = entrance ?? room;
  const ancestorZones = ancestorsOf(primary, byId);

  // Rooms you can see into: open-plan neighbours, plus, from a doorway, the
  // rooms on both sides of it (the room boxes touching the doorway box).
  const visible = visibleRoomIds(room, house.zones);
  if (entrance) {
    for (const r of rooms) {
      const touches = r.boxes!.some((rb) => entrance.boxes!.some((eb) => boxGap(rb, eb) <= DOORWAY_TOUCH_METRES));
      if (touches) visibleRoomIds(r, house.zones).forEach((id) => visible.add(id));
    }
  }
  const objects = house.zones.filter((z) => {
    if (!z.target?.length) return false;
    const r = roomOf(z, byId);
    return r !== undefined && visible.has(r.id);
  });

  // 2. Line of sight: each object's nearest entry point along the ray.
  const hits: { zone: Zone; t: number }[] = [];
  if (dir) {
    for (const zone of objects) {
      let best: number | undefined;
      for (const box of zone.target!) {
        const t = rayHit(box, position, dir);
        if (t !== null && t <= VIEW_METRES && (best === undefined || t < best)) best = t;
      }
      if (best !== undefined) hits.push({ zone, t: best });
    }
    hits.sort((a, b) => a.t - b.t);
  }

  // 3. Around you.
  const nearby = objects
    .map((zone) => {
      const boxes = zone.target!;
      const closest = boxes.reduce((a, b) => (distanceToBox(b, position) < distanceToBox(a, position) ? b : a));
      return {
        zone,
        d: distanceToBox(closest, position),
        bearing: bearingTo(closest, position, dir),
        inRoom: roomOf(zone, byId)?.id === room.id,
      };
    })
    .filter((c) => c.d <= NEARBY_METRES)
    .sort((a, b) => a.d - b.d);

  const pitch = dir ? round((Math.atan2(dir[1], Math.hypot(dir[0], dir[2])) * 180) / Math.PI) : undefined;
  const roomInfo = (zone: Zone) => {
    const r = roomOf(zone, byId);
    return { room: r?.name, inRoom: r?.id === room.id };
  };

  return {
    primaryZone: ref(primary),
    ancestorZones,
    pitch,
    rayHits: hits.slice(0, MAX_RAY_HITS).map((h) => ({ zone: ref(h.zone), ...roomInfo(h.zone), metres: round(h.t) })),
    nearbyObjects: nearby
      .slice(0, MAX_NEARBY)
      .map((c) => ({ zone: ref(c.zone), ...roomInfo(c.zone), metres: round(c.d), bearing: c.bearing })),
    confidence,
    resolution,
  };
}

/**
 * How relevant each zone is to the visitor's current location, 0–1. Used to
 * rank document sections (blueprint § "Retrieval ranking": zone_match). Every
 * candidate the model might pick gets its evidence near the top.
 *   1.0  first object on the line of sight; 0.95 the others it passes through
 *   0.9  objects around them, the closest highest (down to 0.75 at 3 m)
 *   0.8  the room or doorway they're in, and anything else inside it
 *   0.7  the room around a doorway they're in
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
    if (isInside(zone, primaryId)) set(zone.id, 0.8);
  }
  for (const z of location.ancestorZones) set(z.id, 0.7);
  for (const o of location.nearbyObjects) set(o.zone.id, 0.9 - Math.min(o.metres, NEARBY_METRES) * 0.05);
  location.rayHits.forEach((h, i) => set(h.zone.id, i === 0 ? 1 : 0.95));
  return scores;
}

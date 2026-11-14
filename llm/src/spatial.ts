import type { House, Zone, ZoneKind } from "./types";

// Spatial resolution service (blueprint § "Spatial Resolution Service").
// Location is deterministic app logic: the model only ever sees the resolved,
// named result, never raw view IDs or coordinates.
//
// Today the input is the slideshow view the visitor is looking at. When the
// engine lands, add a resolvePose(house, position) that finds the smallest
// enabled zone box containing the camera, and return the same ResolvedLocation.

export type ZoneRef = { id: string; name: string; kind: ZoneKind };

export type ResolvedLocation = {
  viewId?: string;
  primaryZone?: ZoneRef;
  /** Containing zones, innermost first: room → floor → property. */
  ancestorZones: ZoneRef[];
  /** Zones visible from this view (blueprint: nearbyZones). */
  nearbyZones: ZoneRef[];
  confidence: number;
  resolution: "inside-zone" | "unknown";
};

function ref(zone: Zone): ZoneRef {
  return { id: zone.id, name: zone.name, kind: zone.kind };
}

function zoneMap(house: House): Map<string, Zone> {
  return new Map(house.zones.map((z) => [z.id, z]));
}

export function resolveView(house: House, viewId: string | undefined): ResolvedLocation {
  const view = viewId ? house.views.find((v) => v.id === viewId) : undefined;
  const zones = zoneMap(house);
  const primary = view ? zones.get(view.zoneId) : undefined;

  if (!view || !primary) {
    // Never guess a room: no known view means no location.
    return { viewId, ancestorZones: [], nearbyZones: [], confidence: 0, resolution: "unknown" };
  }

  const ancestorZones: ZoneRef[] = [];
  for (let z = primary.parentId ? zones.get(primary.parentId) : undefined; z; z = z.parentId ? zones.get(z.parentId) : undefined) {
    if (z.kind !== "property") ancestorZones.push(ref(z));
  }

  const nearbyZones = view.visibleZoneIds.flatMap((id) => {
    const z = zones.get(id);
    return z ? [ref(z)] : [];
  });

  // Views are hand-authored, so the match is exact. Pose-based resolution
  // would lower this near zone boundaries.
  return { viewId, primaryZone: ref(primary), ancestorZones, nearbyZones, confidence: 1, resolution: "inside-zone" };
}

/**
 * How relevant each zone is to the visitor's current location, 0–1. Used to
 * rank document sections (blueprint § "Retrieval ranking": zone_match).
 *   1.0  the zone they're in, or something inside it (Kitchen → Kitchen island)
 *   0.7  a zone visible from here
 *   0.3  a containing zone (Main floor)
 */
export function zoneRelevance(house: House, location: ResolvedLocation): Map<string, number> {
  const scores = new Map<string, number>();
  const primaryId = location.primaryZone?.id;
  if (!primaryId) return scores;

  const set = (id: string, score: number) => scores.set(id, Math.max(scores.get(id) ?? 0, score));
  const zones = zoneMap(house);
  const isInside = (zone: Zone, ancestorId: string): boolean => {
    for (let z: Zone | undefined = zone; z; z = z.parentId ? zones.get(z.parentId) : undefined) {
      if (z.id === ancestorId) return true;
    }
    return false;
  };

  for (const zone of house.zones) {
    if (isInside(zone, primaryId)) set(zone.id, 1);
  }
  for (const z of location.nearbyZones) set(z.id, 0.7);
  for (const z of location.ancestorZones) set(z.id, 0.3);
  return scores;
}

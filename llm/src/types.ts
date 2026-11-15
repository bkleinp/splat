// Shapes mirror the blueprint's data model (listing_facts, source_documents,
// document_chunks, spatial_zones) so swapping seed data for Postgres later is
// a loader change.
// Pure types only: the web client imports these with `import type`.

export type SourceKind =
  | "realtor_upload"
  | "listing_feed"
  | "public_record"
  | "manual_note"
  | "generated_summary";

export type ListingFact = {
  key: string;
  label: string;
  displayValue: string;
  /** Human-readable source label shown as a citation chip. */
  source: string;
};

export type DocumentSection = {
  title: string;
  pageNumber?: number;
  content: string;
  /** IDs of the zones this section is about (see House.zones). Empty = whole home / general. */
  zones: string[];
};

export type SourceDocument = {
  id: string;
  filename: string;
  title: string;
  sourceKind: SourceKind;
  sections: DocumentSection[];
};

export type ZoneKind = "property" | "floor" | "room" | "feature" | "appliance" | "entrance" | "outdoor_area";

export type Vec3 = [number, number, number];

/** Axis-aligned box in the viewer's world coordinates (metres, y up). */
export type Box = { min: Vec3; max: Vec3 };

/** A named area of the home (blueprint: spatial_zones). */
export type Zone = {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Containing zone: feature/appliance/entrance → room → property. */
  parentId?: string;
  aliases?: string[];
  /**
   * Where you stand to be in this zone: a room's floor area, or a doorway for
   * an entrance. Several boxes make an L-shape.
   */
  boxes?: Box[];
  /**
   * Features and appliances: the object itself. The camera's view ray is cast
   * against these, and the first one it hits is what the visitor is facing.
   */
  target?: Box[];
  /**
   * Rooms only: rooms that are open plan with this one (no wall between), so
   * the line of sight carries on into them. Rooms joined only by a doorway
   * aren't listed: you see into those while standing in the doorway (an
   * entrance zone). Symmetric: listing it on one side is enough.
   */
  opensTo?: string[];
};

/** A 3D Gaussian-splat tour, rendered by the viewer in engine/supersplat-viewer. */
export type HouseScene = {
  /** Splat content: a .sog / .ply file, or a streamed meta.json. */
  contentUrl: string;
  /** Viewer experience settings (camera start, background, post effects). */
  settingsUrl: string;
  /** Voxel collision for walk mode. */
  collisionUrl?: string;
  /** Anti-aliasing compensation override; match what the scene was trained with. */
  aa?: boolean;
  credit: string;
};

export type House = {
  id: string;
  slug: string;
  title: string;
  address: string;
  city: string;
  region: string;
  summary: string;
  zones: Zone[];
  /** The 3D tour. Zone boxes are in this scene's world coordinates. */
  scene?: HouseScene;
  facts: ListingFact[];
  documents: SourceDocument[];
};

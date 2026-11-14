// Shapes mirror the blueprint's data model (listing_facts, source_documents,
// document_chunks, spatial_zones) so swapping seed data for Postgres later is
// a loader change.

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

export type ZoneKind = "property" | "floor" | "room" | "feature" | "appliance" | "outdoor_area";

/** A named area of the home (blueprint: spatial_zones), minus the bounding box for now. */
export type Zone = {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Containing zone: feature → room → floor. */
  parentId?: string;
  aliases?: string[];
};

/**
 * A place the visitor can look from. Today: one photo in the slideshow.
 * Later: the 3D viewer's camera pose resolved against zone bounding boxes.
 * Either way, the app (not the model) decides where the visitor is.
 */
export type HouseView = {
  id: string;
  /** Short label shown to the visitor, e.g. "Kitchen". */
  label: string;
  /** Path under apps/web/public. */
  src: string;
  alt: string;
  /** Attribution, when the image license requires one. */
  credit?: string;
  /** The zone the visitor is standing in for this view. */
  zoneId: string;
  /** Other zones clearly in view from here (blueprint: nearbyZones). */
  visibleZoneIds: string[];
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
  /** Slideshow order; the first view is where a visit starts. */
  views: HouseView[];
  facts: ListingFact[];
  documents: SourceDocument[];
};

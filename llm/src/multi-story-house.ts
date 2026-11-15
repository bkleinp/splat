import type { Box, House } from "./types";

// Fake realtor-supplied context for the demo. Listing details (address, price, makes and
// models, history) are fictional; only the 3D scan is real.
//
// 3D tour: the "2508 Paramount House" splat from superspl.at (scene 91c1e47e), streamed from its
// CDN, never copied into the repo (apps/web/tours/multi-story.json).
//
// Zones are in the viewer's world coordinates: x and z across the floor plan, y up. Three
// storeys; floors at about y = 0, 3.3 and 6.4, so with the 1.5 m eye height the camera sits
// near y = 1.5, 4.8 and 7.9.
// - Room boxes: measured on the scene's collision voxels by casting level rays from the logged
//   room centres and doorways to the walls, checked on top-down maps of each storey.
// - Object (target) boxes: each line of the walkthrough log (position, floor, heading, pitch,
//   "<thing> in <room>") cast as a 3D ray through the voxels; the box sits on what it hit,
//   with heights from the voxels. Two lines for one object = the same thing from two angles.
// - Entrance boxes sit on the logged doorway positions.
// Re-log with the walkthrough logger (dev server, ?log on the house page).

/** Floor height (y) of each storey. */
const FLOOR_Y = { 1: 0, 2: 3.3, 3: 6.4 } as const;

/**
 * Camera heights (y) that count as each storey. The stairs between have their own zones,
 * which win where they overlap (smaller footprint).
 */
const CAMERA_Y = { 1: [-3, 3.0], 2: [3.0, 6.0], 3: [6.0, 10] } as const;

type Storey = 1 | 2 | 3;

/** A room's (or doorway's) floor area on a storey: matched on x/z and the camera's height. */
const room = (storey: Storey, x0: number, x1: number, z0: number, z1: number): Box => ({
  min: [x0, CAMERA_Y[storey][0], z0],
  max: [x1, CAMERA_Y[storey][1], z1],
});

/** An area matched for a camera between two heights (the stairs). */
const span = (y0: number, y1: number, x0: number, x1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

/** An object's box, its height measured from its storey's floor. */
const at = (storey: Storey, x0: number, x1: number, z0: number, z1: number, h0: number, h1: number): Box => ({
  min: [x0, FLOOR_Y[storey] + h0, z0],
  max: [x1, FLOOR_Y[storey] + h1, z1],
});

/** A storey's whole extent: where you are when no room there contains you. */
const wholeFloor = (storey: Storey) => room(storey, -12, 12, -10, 5);

export const multiStoryHouse: House = {
  id: "multi-story-house",
  slug: "multi-story-house",
  title: "Multi-Story House",
  address: "4127 Cedar Hollow Lane",
  city: "Austin",
  region: "TX",
  summary:
    "A modern three-story home with an open kitchen and living area, a covered outdoor living room with a fireplace, two bedroom suites, a home office, and a top-floor retreat.",
  zones: [
    { id: "property", name: "Whole property", kind: "property" },

    { id: "floor-1", name: "Ground floor", kind: "floor", parentId: "property", aliases: ["first floor", "downstairs", "main floor"], boxes: [wholeFloor(1)] },
    { id: "floor-2", name: "Second floor", kind: "floor", parentId: "property", aliases: ["upstairs", "middle floor"], boxes: [wholeFloor(2)] },
    { id: "floor-3", name: "Third floor", kind: "floor", parentId: "property", aliases: ["top floor", "upstairs"], boxes: [wholeFloor(3)] },

    // ---------- Ground floor rooms. opensTo = open plan (no wall between).
    {
      id: "kitchen",
      name: "Kitchen",
      kind: "room",
      parentId: "floor-1",
      boxes: [room(1, -2.75, 1.0, -7.7, -4.6)],
      opensTo: ["living-room"],
    },
    {
      // The open living area: the living room proper, plus the hall from the front door past
      // the stairs and the wine-cooler nook (all one space, as logged).
      id: "living-room",
      name: "Living room",
      kind: "room",
      parentId: "floor-1",
      aliases: ["living area", "family room", "dining area", "hall"],
      boxes: [room(1, 1.0, 4.75, -7.7, -1.25), room(1, -2.75, 1.0, -4.6, -1.2), room(1, -5.15, -2.75, -5.4, -4.45)],
      opensTo: ["patio"],
    },
    { id: "powder-room", name: "Ground-floor bathroom", kind: "room", parentId: "floor-1", aliases: ["half bath", "powder room", "guest bathroom"], boxes: [room(1, -7.1, -3.65, -6.55, -5.55)] },
    { id: "bedroom-1", name: "Ground-floor bedroom", kind: "room", parentId: "floor-1", aliases: ["guest suite", "first floor bedroom", "downstairs bedroom"], boxes: [room(1, -6.2, -1.8, -0.25, 2.95)] },
    { id: "bedroom-1-bath", name: "Ground-floor ensuite", kind: "room", parentId: "floor-1", aliases: ["en-suite", "guest bathroom", "first floor ensuite"], boxes: [room(1, -8.7, -6.3, -2.0, 2.95)] },
    { id: "storage-1", name: "Under-stair storage", kind: "room", parentId: "floor-1", aliases: ["storage closet", "closet"], boxes: [room(1, -4.62, -2.5, -2.96, -2.0)] },
    { id: "garage", name: "Garage", kind: "room", parentId: "floor-1", boxes: [room(1, 4.8, 8.85, -2.2, 3.35)] },
    { id: "patio", name: "Covered patio", kind: "outdoor_area", parentId: "floor-1", aliases: ["patio", "outdoor living room", "outside", "porch"], boxes: [room(1, 4.8, 9.5, -7.85, -2.9)] },
    { id: "stairs-1", name: "Stairs to the second floor", kind: "room", parentId: "floor-1", aliases: ["stairs", "staircase", "landing"], boxes: [span(2.4, 4.65, -5.75, -2.4, -4.3, -1.95)] },

    // ---------- Second floor rooms
    { id: "hall-2", name: "Second-floor hallway", kind: "room", parentId: "floor-2", aliases: ["hallway", "landing"], boxes: [room(2, -2.7, 2.3, -3.55, -1.35), room(2, -2.7, -1.55, -5.3, -3.55)] },
    { id: "bedroom-2", name: "Second-floor bedroom", kind: "room", parentId: "floor-2", aliases: ["primary bedroom", "master bedroom", "upstairs bedroom"], boxes: [room(2, -6.1, -1.8, -0.25, 2.95)] },
    { id: "bedroom-2-bath", name: "Second-floor ensuite", kind: "room", parentId: "floor-2", aliases: ["en-suite", "primary bathroom", "master bathroom"], boxes: [room(2, -8.5, -6.3, -2.0, 2.95)] },
    { id: "office", name: "Office", kind: "room", parentId: "floor-2", aliases: ["study", "home office", "library"], boxes: [room(2, 1.3, 4.7, -7.7, -3.75)] },
    { id: "storage-2", name: "Second-floor under-stair storage", kind: "room", parentId: "floor-2", aliases: ["storage closet", "closet"], boxes: [room(2, -1.5, -0.8, -5.5, -3.55)] },
    { id: "stairs-2", name: "Stairs to the third floor", kind: "room", parentId: "floor-2", aliases: ["stairs", "staircase", "landing"], boxes: [span(5.3, 8.0, -2.65, -0.7, -6.75, -3.3)] },

    // ---------- Third floor rooms
    { id: "loft", name: "Third-floor living space", kind: "room", parentId: "floor-3", aliases: ["loft", "media room", "lounge", "retreat"], boxes: [room(3, -0.6, 2.15, -7.15, -1.6), room(3, -1.55, -0.6, -3.5, -1.6)] },
    { id: "bath-3", name: "Third-floor bathroom", kind: "room", parentId: "floor-3", aliases: ["bathroom", "upstairs bathroom"], boxes: [room(3, -3.1, -1.6, -3.75, -1.55)] },

    // ---------- Doorways: where you stand to be "at" them; you see into the rooms on both sides.
    { id: "front-door", name: "Front door", kind: "entrance", parentId: "living-room", aliases: ["entry", "entryway", "front entrance"], boxes: [room(1, -0.75, 0.1, -1.55, -0.6)] },
    { id: "patio-door", name: "Patio doors", kind: "entrance", parentId: "patio", aliases: ["sliding doors", "back door"], boxes: [room(1, 4.55, 5.1, -6.1, -4.25)] },
    { id: "garage-door", name: "Door to the garage", kind: "entrance", parentId: "garage", aliases: ["garage entry"], boxes: [room(1, 7.95, 8.85, -2.95, -2.15)] },
    { id: "powder-room-entrance", name: "Doorway", kind: "entrance", parentId: "powder-room", aliases: ["bathroom door"], boxes: [room(1, -4.95, -4.3, -5.65, -5.3)] },
    { id: "bedroom-1-entrance", name: "Entrance", kind: "entrance", parentId: "bedroom-1", aliases: ["bedroom door", "hallway"], boxes: [room(1, -2.8, -1.85, -2.1, -0.25)] },
    { id: "bedroom-1-bath-entrance", name: "Doorway", kind: "entrance", parentId: "bedroom-1-bath", aliases: ["bathroom door"], boxes: [room(1, -6.5, -6.1, 0.1, 0.8)] },
    { id: "storage-1-entrance", name: "Doorway", kind: "entrance", parentId: "storage-1", aliases: ["closet door"], boxes: [room(1, -3.1, -2.45, -2.85, -2.15)] },
    { id: "bedroom-2-entrance", name: "Entrance", kind: "entrance", parentId: "bedroom-2", aliases: ["bedroom door"], boxes: [room(2, -2.7, -1.9, -1.6, -0.25)] },
    { id: "bedroom-2-bath-entrance", name: "Doorway", kind: "entrance", parentId: "bedroom-2-bath", aliases: ["bathroom door"], boxes: [room(2, -6.4, -6.0, 0.2, 0.8)] },
    { id: "storage-2-entrance", name: "Doorway", kind: "entrance", parentId: "storage-2", aliases: ["closet door"], boxes: [room(2, -1.5, -0.8, -3.9, -3.3)] },
    { id: "bath-3-entrance", name: "Doorway", kind: "entrance", parentId: "bath-3", aliases: ["bathroom door"], boxes: [room(3, -1.85, -1.4, -3.05, -2.35)] },

    // ---------- Objects: the things the view ray can land on.
    // Kitchen: the island holds the sink; the cooktop and oven sit in the back counter.
    { id: "kitchen-island", name: "Island", kind: "feature", parentId: "kitchen", aliases: ["kitchen island", "counter"], target: [at(1, -1.6, 1.0, -5.95, -5.05, 0, 0.95)] },
    { id: "kitchen-sink", name: "Sink", kind: "appliance", parentId: "kitchen", aliases: ["kitchen sink", "faucet", "dishwasher"], target: [at(1, -0.65, 0.25, -5.95, -5.05, 0, 1.05)] },
    { id: "kitchen-range", name: "Cooktop & oven", kind: "appliance", parentId: "kitchen", aliases: ["stove", "stovetop", "oven", "range", "burners"], target: [at(1, -0.7, 0.35, -7.7, -7.05, 0, 1.0)] },
    { id: "kitchen-fridge", name: "Refrigerator", kind: "appliance", parentId: "kitchen", aliases: ["fridge", "freezer"], target: [at(1, -2.65, -1.7, -7.7, -6.85, 0, 2.1)] },
    { id: "kitchen-cabinets", name: "Tall cabinets", kind: "feature", parentId: "kitchen", aliases: ["cabinets", "pantry", "storage"], target: [at(1, -2.75, -2.3, -6.85, -5.3, 0, 2.4)] },
    // Living room
    { id: "living-couch", name: "Couch", kind: "feature", parentId: "living-room", aliases: ["sofa"], target: [at(1, 1.8, 4.2, -5.2, -4.15, 0, 0.85)] },
    { id: "living-tv", name: "TV", kind: "feature", parentId: "living-room", aliases: ["television", "tv wall"], target: [at(1, 2.0, 3.7, -1.45, -1.2, 0.9, 2.0)] },
    { id: "living-recliner", name: "Recliner", kind: "feature", parentId: "living-room", aliases: ["armchair", "chair"], target: [at(1, 3.3, 4.3, -2.4, -1.45, 0, 1.0)] },
    { id: "living-recliner-2", name: "Second recliner", kind: "feature", parentId: "living-room", aliases: ["recliner", "armchair", "chair"], target: [at(1, 1.2, 2.2, -2.5, -1.55, 0, 1.0)] },
    { id: "dining-table", name: "Dining table", kind: "feature", parentId: "living-room", aliases: ["table", "dining area"], target: [at(1, 3.0, 4.3, -7.1, -6.2, 0, 0.8)] },
    { id: "wine-cooler", name: "Wine cooler & storage", kind: "appliance", parentId: "living-room", aliases: ["wine fridge", "wine cooler", "bar", "storage"], target: [at(1, -5.4, -4.95, -5.4, -4.45, 0, 2.0)] },
    // Covered patio
    { id: "patio-tv", name: "Outdoor TV", kind: "feature", parentId: "patio", aliases: ["tv", "television"], target: [at(1, 5.9, 7.6, -3.05, -2.8, 1.2, 2.4)] },
    { id: "patio-fireplace", name: "Fireplace", kind: "feature", parentId: "patio", aliases: ["outdoor fireplace", "fire"], target: [at(1, 5.9, 7.6, -3.05, -2.3, 0, 1.2)] },
    { id: "patio-recliner", name: "Recliner", kind: "feature", parentId: "patio", aliases: ["chair", "lounge chair"], target: [at(1, 5.4, 6.4, -6.6, -5.7, 0, 1.0)] },
    { id: "patio-table", name: "Coffee table", kind: "feature", parentId: "patio", aliases: ["table"], target: [at(1, 6.9, 7.8, -5.6, -4.8, 0, 0.5)] },
    { id: "patio-couch", name: "L-shaped couch", kind: "feature", parentId: "patio", aliases: ["couch", "sofa", "sectional", "l couch"], target: [at(1, 6.8, 9.0, -6.85, -6.0, 0, 0.85), at(1, 8.2, 9.0, -6.85, -4.8, 0, 0.85)] },
    { id: "patio-fan", name: "Ceiling fan", kind: "feature", parentId: "patio", aliases: ["fan"], target: [at(1, 7.0, 8.4, -5.5, -4.3, 2.0, 2.7)] },
    // Garage
    { id: "garage-storage", name: "Storage shelves", kind: "feature", parentId: "garage", aliases: ["storage", "shelves", "cabinets"], target: [at(1, 8.3, 8.9, -1.0, 3.3, 0, 2.4)] },
    // Ground-floor bathroom
    { id: "powder-vanity", name: "Sink & vanity", kind: "feature", parentId: "powder-room", aliases: ["sink", "vanity", "mirror"], target: [at(1, -7.1, -6.5, -6.55, -5.6, 0, 2.0)] },
    { id: "powder-toilet", name: "Toilet", kind: "feature", parentId: "powder-room", target: [at(1, -4.15, -3.55, -6.5, -5.75, 0, 0.8)] },
    // Ground-floor bedroom and ensuite
    { id: "bedroom-1-painting", name: "Painting", kind: "feature", parentId: "bedroom-1", aliases: ["art", "artwork", "picture"], target: [at(1, -4.9, -3.4, -0.3, -0.1, 1.0, 2.0)] },
    { id: "bedroom-1-bed", name: "Bed", kind: "feature", parentId: "bedroom-1", target: [at(1, -4.9, -3.0, 0.6, 2.95, 0, 0.85)] },
    { id: "bedroom-1-nightstand", name: "Nightstand", kind: "feature", parentId: "bedroom-1", aliases: ["bedside table"], target: [at(1, -5.9, -5.05, 2.2, 2.95, 0, 0.7)] },
    { id: "bedroom-1-vanity", name: "Sink & vanity", kind: "feature", parentId: "bedroom-1-bath", aliases: ["sink", "vanity", "mirror"], target: [at(1, -8.1, -7.6, -0.95, 0.0, 0, 2.0)] },
    { id: "bedroom-1-vanity-2", name: "Second sink & vanity", kind: "feature", parentId: "bedroom-1-bath", aliases: ["sink", "vanity", "mirror"], target: [at(1, -8.1, -7.6, 0.75, 1.7, 0, 2.0)] },
    { id: "bedroom-1-toilet", name: "Toilet", kind: "feature", parentId: "bedroom-1-bath", target: [at(1, -8.2, -7.4, -2.0, -1.45, 0, 0.8)] },
    { id: "bedroom-1-shower", name: "Shower", kind: "feature", parentId: "bedroom-1-bath", aliases: ["walk-in shower"], target: [at(1, -8.7, -6.5, 2.2, 2.95, 0, 2.2)] },
    // Second-floor bedroom and ensuite
    { id: "bedroom-2-bed", name: "Bed", kind: "feature", parentId: "bedroom-2", target: [at(2, -4.9, -3.0, 0.6, 2.95, 0, 0.85)] },
    { id: "bedroom-2-chair", name: "Chair", kind: "feature", parentId: "bedroom-2", aliases: ["armchair", "reading chair"], target: [at(2, -2.6, -1.85, 2.0, 2.85, 0, 1.0)] },
    { id: "bedroom-2-nightstand", name: "Nightstand", kind: "feature", parentId: "bedroom-2", aliases: ["bedside table"], target: [at(2, -5.9, -5.05, 2.2, 2.95, 0, 0.7)] },
    { id: "bedroom-2-closet", name: "Walk-in closet", kind: "feature", parentId: "bedroom-2", aliases: ["closet", "wardrobe"], target: [at(2, -5.6, -3.0, -2.0, -0.3, 0, 2.4)] },
    { id: "bedroom-2-vanity", name: "Double vanity", kind: "feature", parentId: "bedroom-2-bath", aliases: ["sinks", "sink", "vanity", "mirror"], target: [at(2, -8.2, -7.6, -0.5, 1.3, 0, 2.0)] },
    { id: "bedroom-2-toilet", name: "Toilet", kind: "feature", parentId: "bedroom-2-bath", target: [at(2, -8.1, -7.4, -2.0, -1.2, 0, 0.8)] },
    { id: "bedroom-2-shower", name: "Shower", kind: "feature", parentId: "bedroom-2-bath", aliases: ["walk-in shower"], target: [at(2, -8.5, -6.4, 2.3, 2.95, 0, 2.2)] },
    // Office
    { id: "office-desk", name: "Desk", kind: "feature", parentId: "office", target: [at(2, 3.6, 4.7, -7.7, -6.6, 0, 0.85)] },
    { id: "office-bookshelf", name: "Bookshelf", kind: "feature", parentId: "office", aliases: ["shelves", "bookcase", "shelf"], target: [at(2, 4.3, 4.7, -6.4, -4.8, 0, 2.2)] },
    { id: "office-bookshelf-2", name: "Second bookshelf", kind: "feature", parentId: "office", aliases: ["shelves", "bookcase", "shelf"], target: [at(2, 1.8, 3.4, -7.7, -7.3, 0, 2.2)] },
    { id: "office-couch", name: "Couch", kind: "feature", parentId: "office", aliases: ["sofa", "daybed"], target: [at(2, 1.3, 2.4, -7.2, -4.6, 0, 0.9)] },
    // Second-floor hallway
    { id: "hall-2-cabinets", name: "Storage cabinets", kind: "feature", parentId: "hall-2", aliases: ["cabinets", "storage", "linen closet"], target: [at(2, 2.3, 2.9, -3.5, -1.4, 0, 2.4)] },
    // Third floor
    { id: "loft-couch", name: "Couch", kind: "feature", parentId: "loft", aliases: ["sofa"], target: [at(3, -0.55, 0.4, -6.2, -3.9, 0, 0.9)] },
    { id: "loft-tv", name: "TV", kind: "feature", parentId: "loft", aliases: ["television"], target: [at(3, 1.55, 2.15, -6.8, -5.2, 0.6, 1.8)] },
    { id: "loft-workstation", name: "Workstation", kind: "feature", parentId: "loft", aliases: ["desk", "work station", "computer"], target: [at(3, 1.3, 2.15, -2.9, -1.6, 0, 1.2)] },
    { id: "bath-3-vanity", name: "Sink & vanity", kind: "feature", parentId: "bath-3", aliases: ["sink", "vanity", "mirror"], target: [at(3, -2.6, -1.6, -3.75, -3.3, 0, 2.0)] },
    { id: "bath-3-toilet", name: "Toilet", kind: "feature", parentId: "bath-3", target: [at(3, -3.1, -2.6, -3.6, -3.0, 0, 0.8)] },
    { id: "bath-3-shower", name: "Shower", kind: "feature", parentId: "bath-3", target: [at(3, -3.1, -2.0, -2.0, -1.55, 0, 2.2)] },
  ],
  // The walk-through: apps/web/tours/multi-story.json (content, collision, look, walk feel, floor plan).
  scene: { tour: "multi-story" },
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$1,195,000", source: "Listing basics form" },
    { key: "property_type", label: "Property type", displayValue: "Single-family home, three stories", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "2 suites (one on the ground floor, one on the second floor), plus an office and a third-floor living space", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "3.5 (two ensuites, a third-floor full bath, a ground-floor half bath)", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "2,180 sq ft (ground 1,020, second 760, third 400)", source: "County appraisal district record" },
    { key: "outdoor_sqft", label: "Covered patio", displayValue: "250 sq ft, with fireplace and TV", source: "Floor plan & dimensions" },
    { key: "lot_size", label: "Lot", displayValue: "0.11 acre (4,790 sq ft)", source: "County appraisal district record" },
    { key: "year_built", label: "Year built", displayValue: "2019; kitchen updated 2024", source: "County appraisal district record" },
    { key: "garage", label: "Garage", displayValue: "Attached one-car garage with storage shelving and an EV charger", source: "Realtor amenities form" },
    { key: "flooring", label: "Flooring", displayValue: "Polished concrete on the ground floor; white oak on the stairs and upper floors; porcelain tile in the baths", source: "Realtor amenities form" },
    { key: "ceiling_height", label: "Ceilings", displayValue: "10 ft ground floor, 9 ft upper floors", source: "Floor plan & dimensions" },
    { key: "countertop_material", label: "Countertops", displayValue: "Honed white quartzite in the kitchen; quartz in the baths", source: "Appliance & fixture schedule" },
    {
      key: "appliances",
      label: "Kitchen appliances",
      displayValue: "Wolf 36-inch induction cooktop with a Wolf wall oven below, Sub-Zero 30-inch built-in fridge, Bosch Benchmark dishwasher, Sub-Zero 24-inch wine storage",
      source: "Appliance & fixture schedule",
    },
    { key: "heating_type", label: "Heating & cooling", displayValue: "Three-zone ducted heat pump (Mitsubishi), one zone per floor", source: "Seller disclosure" },
    { key: "water_heater", label: "Water heater", displayValue: "Rheem 50-gallon hybrid heat-pump water heater (2023)", source: "Seller disclosure" },
    { key: "solar", label: "Solar", displayValue: "6.4 kW owned rooftop solar (no lease)", source: "Seller disclosure" },
    { key: "property_tax", label: "Property tax", displayValue: "About $19,800 / year (2026 estimate)", source: "County appraisal district record" },
    { key: "hoa_fee", label: "HOA", displayValue: "None", source: "Listing basics form" },
  ],
  documents: [
    {
      id: "msh-amenities",
      filename: "cedar-hollow-amenities.pdf",
      title: "Realtor amenities form",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Staging",
          pageNumber: 1,
          zones: [],
          content:
            "Furniture, rugs, artwork, and decor shown in the 3D tour belong to the current owners and are not included in the sale. Light fixtures, window coverings, built-ins, the wine cooler, and all kitchen appliances are included. The outdoor TV and the garage shelving are included.",
        },
        {
          title: "Layout",
          pageNumber: 1,
          zones: ["floor-1", "floor-2", "floor-3"],
          content:
            "Three floors joined by one staircase. Ground floor: the front door opens into an open kitchen and living area, with sliding doors to a covered outdoor living room (patio) and a door from the patio to the garage; a ground-floor bedroom suite, a half bath, and under-stair storage sit off the hall. Second floor: a bedroom suite with a walk-in closet, a home office, and hallway storage. Third floor: a living space with its own full bathroom.",
        },
        {
          title: "Ground floor",
          pageNumber: 1,
          zones: ["floor-1"],
          content: "Polished concrete floors, 10-foot ceilings, and recessed lighting on dimmers. The kitchen and living room are one open space that continues out onto the covered patio through wide sliding doors.",
        },
        {
          title: "Front door and hall",
          pageNumber: 1,
          zones: ["front-door", "stairs-1", "storage-1", "storage-1-entrance"],
          content:
            "The front door opens into the hall at the foot of the stairs. Under the stairs is a walk-in storage closet with shelving and a light.",
        },
        {
          title: "Living room",
          pageNumber: 1,
          zones: ["living-room", "living-couch", "living-recliner", "living-recliner-2"],
          content:
            "Open living room with a couch facing the TV wall and two recliners (shown furnished). It opens to the covered patio through the sliding doors and to the kitchen at the other end.",
        },
        {
          title: "Living room TV wall",
          pageNumber: 1,
          zones: ["living-tv"],
          content: "Wall-mounted TV on the living room's long wall, with power and HDMI run inside the wall to a media cabinet. The TV shown stays with the house.",
        },
        {
          title: "Dining table",
          pageNumber: 1,
          zones: ["dining-table"],
          content: "The dining area is at the patio end of the living room, by the sliding doors, and seats six (table shown furnished). A pendant hangs above it.",
        },
        {
          title: "Wine cooler and storage",
          pageNumber: 1,
          zones: ["wine-cooler"],
          content: "Built-in wine cooler in a nook off the hall, between the stairs and the half bath, with storage cabinets above and below.",
        },
        {
          title: "Kitchen",
          pageNumber: 2,
          zones: ["kitchen"],
          content:
            "Updated in 2024: a modern kitchen open to the living room, with flat-panel walnut cabinetry, honed white quartzite counters, a center island with the sink, and the cooktop and oven on the back counter.",
        },
        {
          title: "Kitchen island and sink",
          pageNumber: 2,
          zones: ["kitchen-island", "kitchen-sink"],
          content: "Center island with an undermount sink, a pull-down faucet, the dishwasher beside it, and deep drawers on the living-room side.",
        },
        {
          title: "Cooktop and oven",
          pageNumber: 2,
          zones: ["kitchen-range"],
          content: "Induction cooktop set into the back counter with a wall oven built in below it and a flush ceiling-mounted hood above.",
        },
        {
          title: "Refrigerator",
          pageNumber: 2,
          zones: ["kitchen-fridge"],
          content: "Panel-ready built-in refrigerator in the back corner, finished to match the cabinets.",
        },
        {
          title: "Tall cabinets",
          pageNumber: 2,
          zones: ["kitchen-cabinets"],
          content: "A wall of floor-to-ceiling cabinets on the kitchen's end wall works as the pantry, with pull-out shelves and a coffee station behind pocket doors.",
        },
        {
          title: "Ground-floor bathroom",
          pageNumber: 2,
          zones: ["powder-room", "powder-room-entrance", "powder-vanity", "powder-toilet"],
          content: "Half bath off the hall by the wine-cooler nook: a long, narrow room with a floating vanity and mirror at the far end and the toilet at the near end.",
        },
        {
          title: "Covered patio",
          pageNumber: 3,
          zones: ["patio", "patio-door"],
          content:
            "Covered outdoor living room off the living area through wide sliding doors, with a wood-plank ceiling, outdoor lighting, and room for a lounge and dining set. It connects to the garage through a side door.",
        },
        {
          title: "Patio fireplace and TV",
          pageNumber: 3,
          zones: ["patio-fireplace", "patio-tv"],
          content: "Gas fireplace in a stone surround with an outdoor-rated TV mounted above it. The fireplace lights from a wall switch.",
        },
        {
          title: "Patio furniture and fan",
          pageNumber: 3,
          zones: ["patio-couch", "patio-recliner", "patio-table", "patio-fan"],
          content: "Furnished with an L-shaped outdoor couch, a recliner, and a coffee table (not included). A damp-rated ceiling fan is centered over the seating.",
        },
        {
          title: "Garage",
          pageNumber: 3,
          zones: ["garage", "garage-door", "garage-storage"],
          content: "Attached one-car garage with an EV charger, an epoxy floor, and a wall of storage shelving along the side wall (included). A side door leads to the patio.",
        },
        {
          title: "Ground-floor bedroom",
          pageNumber: 3,
          zones: ["bedroom-1", "bedroom-1-entrance", "bedroom-1-bed", "bedroom-1-nightstand", "bedroom-1-painting"],
          content: "Bedroom suite at the end of a short hall off the front entry, with room for a queen bed and nightstands (shown furnished). Works as a guest suite. The artwork is not included.",
        },
        {
          title: "Ground-floor ensuite",
          pageNumber: 3,
          zones: ["bedroom-1-bath", "bedroom-1-bath-entrance", "bedroom-1-vanity", "bedroom-1-vanity-2", "bedroom-1-toilet", "bedroom-1-shower"],
          content: "Ensuite bathroom with two separate sinks and vanities, a toilet in its own alcove, and a walk-in shower at the end.",
        },
        {
          title: "Stairs",
          pageNumber: 4,
          zones: ["stairs-1", "stairs-2"],
          content: "White oak stairs with a landing at each turn run from the ground floor to the third floor, with a steel handrail and wall-washer lights.",
        },
        {
          title: "Second-floor bedroom",
          pageNumber: 4,
          zones: ["bedroom-2", "bedroom-2-entrance", "bedroom-2-bed", "bedroom-2-chair", "bedroom-2-nightstand"],
          content: "The main bedroom suite, directly above the ground-floor suite: room for a king bed with nightstands and a reading chair in the corner (shown furnished).",
        },
        {
          title: "Walk-in closet",
          pageNumber: 4,
          zones: ["bedroom-2-closet"],
          content: "Walk-in closet off the second-floor bedroom with built-in hanging, shelving, and drawers.",
        },
        {
          title: "Second-floor ensuite",
          pageNumber: 4,
          zones: ["bedroom-2-bath", "bedroom-2-bath-entrance", "bedroom-2-vanity", "bedroom-2-toilet", "bedroom-2-shower"],
          content: "Ensuite with a double vanity, a toilet in its own alcove, and a frameless glass walk-in shower with a rain head.",
        },
        {
          title: "Office",
          pageNumber: 4,
          zones: ["office", "office-desk", "office-bookshelf", "office-bookshelf-2", "office-couch"],
          content: "Second-floor office with a desk under the window, built-in bookshelves on two walls, and a couch (shown furnished) that makes it a guest room in a pinch. Wired for ethernet.",
        },
        {
          title: "Second-floor hallway and storage",
          pageNumber: 4,
          zones: ["hall-2", "hall-2-cabinets", "storage-2", "storage-2-entrance"],
          content: "The hallway at the top of the stairs has a wall of built-in storage cabinets (linens and laundry supplies) and a storage closet under the stairs to the third floor.",
        },
        {
          title: "Third-floor living space",
          pageNumber: 5,
          zones: ["loft", "loft-couch", "loft-tv", "loft-workstation"],
          content: "Top-floor retreat with a couch facing a TV and a workstation along the far wall (shown furnished). Works as a media room, studio, or third bedroom.",
        },
        {
          title: "Third-floor bathroom",
          pageNumber: 5,
          zones: ["bath-3", "bath-3-entrance", "bath-3-vanity", "bath-3-toilet", "bath-3-shower"],
          content: "Full bathroom off the third-floor living space with a vanity, a toilet, and a shower.",
        },
      ],
    },
    {
      id: "msh-floorplan",
      filename: "floor-plan-and-dimensions.pdf",
      title: "Floor plan & dimensions",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Overview",
          pageNumber: 1,
          zones: [],
          content:
            "2,180 sq ft of interior space on three floors (ground 1,020 sq ft, second 760 sq ft, third 400 sq ft), plus a 250 sq ft covered patio and a 240 sq ft garage. Ceilings: 10 ft on the ground floor, 9 ft above. Measurements are approximate, taken at the widest points.",
        },
        { title: "Kitchen", pageNumber: 1, zones: ["kitchen", "kitchen-island"], content: "Kitchen: 12 ft × 10 ft. Island: 8 ft 6 in × 3 ft." },
        { title: "Living room", pageNumber: 1, zones: ["living-room", "dining-table"], content: "Living room including the dining area: 12 ft × 21 ft. The dining table spot is about 4 ft × 3 ft." },
        { title: "Covered patio", pageNumber: 1, zones: ["patio"], content: "Covered patio: 15 ft × 16 ft. Sliding door opening: 6 ft." },
        { title: "Garage", pageNumber: 1, zones: ["garage"], content: "Garage: 13 ft × 18 ft (one car)." },
        { title: "Ground-floor bathroom", pageNumber: 1, zones: ["powder-room"], content: "Ground-floor half bath: 11 ft × 3 ft 4 in." },
        { title: "Ground-floor suite", pageNumber: 1, zones: ["bedroom-1", "bedroom-1-bath"], content: "Ground-floor bedroom: 14 ft × 10 ft 6 in. Ensuite: 8 ft × 16 ft." },
        { title: "Under-stair storage", pageNumber: 1, zones: ["storage-1"], content: "Under-stair storage closet: 7 ft × 3 ft." },
        { title: "Second-floor suite", pageNumber: 2, zones: ["bedroom-2", "bedroom-2-bath", "bedroom-2-closet"], content: "Second-floor bedroom: 14 ft × 10 ft 6 in. Walk-in closet: 8 ft 6 in × 5 ft 6 in. Ensuite: 7 ft × 16 ft." },
        { title: "Office", pageNumber: 2, zones: ["office"], content: "Office: 11 ft × 13 ft." },
        { title: "Third floor", pageNumber: 3, zones: ["loft", "bath-3"], content: "Third-floor living space: 9 ft × 18 ft. Third-floor bathroom: 5 ft × 7 ft." },
      ],
    },
    {
      id: "msh-appliances",
      filename: "appliance-and-fixture-schedule.pdf",
      title: "Appliance & fixture schedule",
      sourceKind: "realtor_upload",
      sections: [
        { title: "Cooktop and oven", pageNumber: 1, zones: ["kitchen-range"], content: "Wolf 36-inch induction cooktop with a Wolf M Series 30-inch convection wall oven installed below it. Installed 2024." },
        { title: "Refrigerator", pageNumber: 1, zones: ["kitchen-fridge"], content: "Sub-Zero Designer 30-inch panel-ready column refrigerator. Installed 2024." },
        { title: "Sink and dishwasher", pageNumber: 1, zones: ["kitchen-sink", "kitchen-island"], content: "Kohler Strive 32-inch undermount sink, Kohler Purist pull-down faucet in matte black, and a Bosch Benchmark panel-ready dishwasher." },
        { title: "Counters and cabinetry", pageNumber: 1, zones: ["kitchen-cabinets", "kitchen-island"], content: "Honed Taj Mahal quartzite, 3 cm. Flat-panel walnut cabinetry with Blum soft-close hardware; the tall cabinets have pull-out pantry shelves." },
        { title: "Wine cooler", pageNumber: 1, zones: ["wine-cooler"], content: "Sub-Zero 24-inch undercounter wine storage, 46 bottles, dual temperature zones." },
        { title: "Patio fireplace and TV", pageNumber: 2, zones: ["patio-fireplace", "patio-tv"], content: "Napoleon 42-inch outdoor gas fireplace insert. Samsung 65-inch The Terrace outdoor TV (included). Minka-Aire 60-inch damp-rated ceiling fan." },
        { title: "Garage", pageNumber: 2, zones: ["garage", "garage-storage"], content: "ChargePoint Home Flex EV charger (48 A). Steel garage shelving, 8 ft long." },
        { title: "Bathrooms", pageNumber: 2, zones: ["bedroom-1-vanity", "bedroom-1-vanity-2", "bedroom-2-vanity", "bath-3-vanity", "powder-vanity"], content: "Floating walnut vanities with quartz tops and Kohler Verticyl undermount sinks; Brizo Frank Lloyd Wright faucets in matte black; lighted mirrors." },
        { title: "Showers and toilets", pageNumber: 2, zones: ["bedroom-1-shower", "bedroom-2-shower", "bath-3-shower", "bedroom-1-toilet", "bedroom-2-toilet", "bath-3-toilet", "powder-toilet"], content: "Frameless glass showers with Brizo rain heads and hand showers; TOTO Aquia wall-hung toilets throughout." },
        { title: "Whole-home systems", pageNumber: 3, zones: [], content: "Mitsubishi three-zone ducted heat pump (one zone per floor, 2019, serviced yearly). Rheem 50-gallon hybrid water heater (2023). 6.4 kW owned rooftop solar. Whole-house water softener. Cat 6 to the office and the third floor. Smart lock on the front door." },
      ],
    },
    {
      id: "msh-disclosure",
      filename: "seller-disclosure-summary.pdf",
      title: "Seller disclosure",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Systems and condition",
          pageNumber: 1,
          zones: [],
          content:
            "Built in 2019. HVAC serviced yearly; no major repairs. Water heater replaced 2023. Flat membrane roof (TPO) from 2019, with a 20-year manufacturer warranty, transferable. Slab foundation; no known structural issues. No known flooding; the lot is outside the 100-year floodplain.",
        },
        { title: "Updates and permits", pageNumber: 1, zones: ["kitchen"], content: "The 2024 kitchen update (cabinets, counters, appliances) was permitted and finaled with the City of Austin." },
        { title: "Solar", pageNumber: 1, zones: [], content: "The 6.4 kW solar system is owned outright (no lease or loan) and transfers with the house. Average electric bill over the last 12 months: $58/month." },
      ],
    },
    {
      id: "msh-neighborhood",
      filename: "neighborhood-notes.md",
      title: "Neighborhood guide",
      sourceKind: "manual_note",
      sections: [
        {
          title: "Nearby",
          zones: [],
          content:
            "No HOA. Quiet residential street about 10 minutes to downtown Austin and 5 minutes to the Barton Creek Greenbelt trailhead. Coffee shops, restaurants, and a grocery store within a mile. Zoned schools: Cedar Hollow Elementary, Barton Ridge Middle, and Live Oak Ridge High (buyers should verify boundaries with the district).",
        },
      ],
    },
  ],
};

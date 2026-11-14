import type { House } from "./types";

// Fake realtor-supplied context for the demo. Listing details are fictional.
// House 1's context is written to match its photos (apps/web/public/houses/house-1/)
// so location-aware answers agree with what the visitor is looking at.

const house1: House = {
  id: "house-1",
  slug: "house-1",
  title: "The Maple Court Townhome",
  address: "418 Maple Court",
  city: "Alder Springs",
  region: "CA",
  summary:
    "A light-filled two-story townhome, renovated in 2023, with an open kitchen and island, a vaulted living room with a gas fireplace, and a private back patio.",
  zones: [
    { id: "property", name: "Whole property", kind: "property" },
    { id: "exterior", name: "Exterior & garage", kind: "outdoor_area", parentId: "property", aliases: ["outside", "front", "garage", "driveway"] },
    { id: "patio", name: "Back patio", kind: "outdoor_area", parentId: "property", aliases: ["yard", "garden", "backyard"] },
    { id: "main-floor", name: "Main floor", kind: "floor", parentId: "property", aliases: ["downstairs", "first floor"] },
    { id: "kitchen", name: "Kitchen", kind: "room", parentId: "main-floor" },
    { id: "kitchen-island", name: "Kitchen island", kind: "feature", parentId: "kitchen", aliases: ["island", "breakfast bar"] },
    { id: "range", name: "Range", kind: "appliance", parentId: "kitchen", aliases: ["stove", "oven", "cooktop"] },
    { id: "dining", name: "Dining area", kind: "room", parentId: "main-floor", aliases: ["dining room"] },
    { id: "living-room", name: "Living room", kind: "room", parentId: "main-floor", aliases: ["family room", "lounge"] },
    { id: "upper-floor", name: "Upper floor", kind: "floor", parentId: "property", aliases: ["upstairs", "second floor"] },
    { id: "primary-bedroom", name: "Primary bedroom", kind: "room", parentId: "upper-floor", aliases: ["master bedroom", "main bedroom"] },
    { id: "primary-bath", name: "Primary bathroom", kind: "room", parentId: "upper-floor", aliases: ["en-suite", "master bath"] },
    { id: "hall-bath", name: "Hall bathroom", kind: "room", parentId: "upper-floor", aliases: ["guest bathroom", "second bathroom"] },
    { id: "bedroom-2", name: "Second bedroom", kind: "room", parentId: "upper-floor", aliases: ["guest bedroom"] },
  ],
  views: [
    {
      id: "exterior",
      label: "Exterior",
      src: "/houses/house-1/exterior.jpg",
      alt: "Two-story townhome with a clay tile roof, attached two-car garage, and hedge-lined front walkway",
      zoneId: "exterior",
      visibleZoneIds: [],
    },
    {
      id: "kitchen",
      label: "Kitchen",
      src: "/houses/house-1/kitchen.webp",
      alt: "Open kitchen with a large island and four stools, dining table, and sliding door to the patio",
      zoneId: "kitchen",
      visibleZoneIds: ["kitchen-island", "range", "dining", "patio"],
    },
    {
      id: "living-room",
      label: "Living room",
      src: "/houses/house-1/living-room.jpg",
      alt: "Vaulted living room with a sectional sofa, wood-slat fireplace wall, and staircase railing above",
      zoneId: "living-room",
      visibleZoneIds: [],
    },
    {
      id: "bathroom",
      label: "Hall bathroom",
      src: "/houses/house-1/bathroom.jpg",
      alt: "Bathroom with a tub-shower combination and tiled vanity, with a bedroom visible through the doorway",
      zoneId: "hall-bath",
      visibleZoneIds: ["bedroom-2"],
    },
    {
      id: "bedroom",
      label: "Primary bedroom",
      src: "/houses/house-1/bedroom.jpg",
      alt: "Vaulted primary bedroom with ceiling fan, wardrobe closets, and an open double-sink vanity",
      zoneId: "primary-bedroom",
      visibleZoneIds: ["primary-bath"],
    },
  ],
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$1,085,000", source: "Listing basics form" },
    { key: "property_type", label: "Property type", displayValue: "Two-story townhome", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "3", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "2.5", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "1,720 sq ft", source: "County assessor record" },
    { key: "year_built", label: "Year built", displayValue: "1986", source: "County assessor record" },
    { key: "countertop_material", label: "Countertops", displayValue: "White quartz, kitchen and island", source: "Realtor amenities form" },
    { key: "island_seating", label: "Island seating", displayValue: "4 stools", source: "Realtor amenities form" },
    { key: "flooring", label: "Flooring", displayValue: "Wood-look luxury vinyl plank throughout, installed 2023", source: "Seller disclosure" },
    { key: "heating_type", label: "Heating & cooling", displayValue: "Gas forced-air furnace and central air conditioning", source: "Seller disclosure" },
    { key: "fireplace", label: "Fireplace", displayValue: "Gas fireplace in the living room", source: "Realtor amenities form" },
    { key: "parking", label: "Parking", displayValue: "Attached 2-car garage", source: "Listing basics form" },
    { key: "hoa_fee", label: "HOA", displayValue: "$395 / month", source: "HOA documents" },
  ],
  documents: [
    {
      id: "h1-amenities",
      filename: "maple-court-amenities.pdf",
      title: "Realtor amenities form",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Exterior",
          pageNumber: 1,
          zones: ["exterior"],
          content:
            "Clay tile roof and painted lap siding. Attached two-car garage with an automatic opener and interior access. Landscaped front walkway lined with mature hedges.",
        },
        {
          title: "Kitchen",
          pageNumber: 1,
          zones: ["kitchen"],
          content:
            "Kitchen renovated in 2023. Flat-panel cabinets in a warm greige finish with matte black pulls, white quartz countertops, and a hexagon marble-look tile backsplash on the sink wall. Stainless steel appliances include a gas range, over-the-range microwave, and dishwasher. The undermount sink sits under a window looking onto the garden.",
        },
        {
          title: "Kitchen island",
          pageNumber: 2,
          zones: ["kitchen-island"],
          content:
            "Large island with white quartz counters, seating for four on the dining side, and cabinet storage on the kitchen side. Linear pendant light overhead.",
        },
        {
          title: "Dining area",
          pageNumber: 2,
          zones: ["dining"],
          content:
            "Dining area open to the kitchen with a vaulted ceiling and pendant light. A sliding glass door opens to the back patio.",
        },
        {
          title: "Living room",
          pageNumber: 2,
          zones: ["living-room"],
          content:
            "Vaulted living room with a gas fireplace set in a floor-to-ceiling wood-slat feature wall, pre-wired for a wall-mounted TV. The staircase to the upper floor rises from this room.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 3,
          zones: ["primary-bedroom"],
          content:
            "Upstairs primary bedroom with a vaulted ceiling, ceiling fan, and two built-in wardrobe closets. Opens directly to the en-suite bathroom.",
        },
        {
          title: "Primary bathroom",
          pageNumber: 3,
          zones: ["primary-bath"],
          content: "En-suite with a double-sink vanity in dark wood, two mirrors, and a separate toilet and shower room.",
        },
        {
          title: "Hall bathroom",
          pageNumber: 3,
          zones: ["hall-bath"],
          content: "Full bathroom with a tub-shower combination, white square wall tile, and a tiled vanity top. Shared by the second and third bedrooms.",
        },
        {
          title: "Second bedroom",
          pageNumber: 3,
          zones: ["bedroom-2"],
          content: "Second bedroom next to the hall bathroom, with a vaulted ceiling and a reach-in closet.",
        },
        {
          title: "Back patio",
          pageNumber: 4,
          zones: ["patio"],
          content: "Private fenced patio off the dining area, with mature plantings along the fence line.",
        },
      ],
    },
    {
      id: "h1-range-manual",
      filename: "range-manual-excerpt.pdf",
      title: "Range manufacturer manual (excerpt)",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Model overview",
          pageNumber: 4,
          zones: ["range"],
          content: "30-inch freestanding gas range with five sealed burners, including a high-output burner, and a convection oven. Oven capacity 5.8 cu ft.",
        },
        {
          title: "Care and cleaning",
          pageNumber: 12,
          zones: ["range"],
          content: "Use a non-abrasive cleaner on stainless surfaces. Grates and burner caps are dishwasher-safe. The self-clean cycle runs 2–4 hours; remove oven racks before starting.",
        },
      ],
    },
    {
      id: "h1-disclosure",
      filename: "seller-disclosure-summary.pdf",
      title: "Seller disclosure",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Systems and repairs",
          pageNumber: 2,
          zones: [],
          content:
            "Kitchen renovated and luxury vinyl plank flooring installed in 2023. Water heater replaced in 2021. Furnace serviced annually; central air conditioning installed 2019. No known active leaks.",
        },
      ],
    },
    {
      id: "h1-hoa",
      filename: "hoa-summary.pdf",
      title: "HOA documents",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Fees and inclusions",
          pageNumber: 1,
          zones: [],
          content:
            "Monthly dues are $395 and cover exterior building maintenance, roof, common-area landscaping, and the master insurance policy. The HOA re-roofed the building in 2020.",
        },
        {
          title: "Rules",
          pageNumber: 2,
          zones: [],
          content: "Up to two pets per unit. Rentals must be at least 30 days. Exterior changes require HOA approval.",
        },
      ],
    },
    {
      id: "h1-neighborhood",
      filename: "neighborhood-notes.md",
      title: "Neighborhood guide",
      sourceKind: "manual_note",
      sections: [
        {
          title: "Nearby",
          zones: [],
          content:
            "Alder Springs Park is approximately 0.4 miles away. The nearest bus stop (Route 12) is about 0.2 miles away. The public library branch is approximately 0.8 miles away.",
        },
      ],
    },
  ],
};

const house2: House = {
  id: "house-2",
  slug: "house-2",
  title: "Harbor Street Loft",
  address: "77 Harbor Street, Unit 5B",
  city: "Port Wren",
  region: "WA",
  summary:
    "A converted 1910 warehouse loft with 14-foot ceilings, exposed brick, and water views, in a building with a shared rooftop deck.",
  zones: [
    { id: "property", name: "Whole property", kind: "property" },
    { id: "building-exterior", name: "Building exterior", kind: "outdoor_area", parentId: "property", aliases: ["outside", "building"] },
    { id: "unit", name: "Unit 5B", kind: "floor", parentId: "property" },
    { id: "entry", name: "Entry", kind: "room", parentId: "unit", aliases: ["foyer"] },
    { id: "kitchen", name: "Kitchen", kind: "room", parentId: "unit" },
    { id: "kitchen-island", name: "Kitchen island", kind: "feature", parentId: "kitchen", aliases: ["island"] },
    { id: "living-room", name: "Living room", kind: "room", parentId: "unit", aliases: ["living area"] },
    { id: "primary-bedroom", name: "Primary bedroom", kind: "room", parentId: "unit", aliases: ["mezzanine", "master bedroom"] },
  ],
  views: [
    {
      id: "exterior",
      label: "Exterior",
      src: "/houses/house-2.jpg",
      alt: "Converted brick warehouse beside a river with a waterside walking path",
      credit: "Photo: David Smith, CC BY-SA 2.0, via Wikimedia Commons",
      zoneId: "building-exterior",
      visibleZoneIds: [],
    },
  ],
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$749,000", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "2", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "1.5", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "1,260 sq ft", source: "Condo declaration" },
    { key: "year_built", label: "Year built", displayValue: "1910 (converted 2008)", source: "County assessor record" },
    { key: "countertop_material", label: "Countertops", displayValue: "Honed black soapstone; butcher-block island top", source: "Realtor amenities form" },
    { key: "island_seating", label: "Island seating", displayValue: "3 stools", source: "Realtor amenities form" },
    { key: "heating_type", label: "Heating", displayValue: "Hydronic radiators (building boiler) + ductless mini-split in living area", source: "HOA documents" },
    { key: "parking", label: "Parking", displayValue: "1 deeded garage space (#14)", source: "Condo declaration" },
    { key: "hoa_fee", label: "HOA", displayValue: "$612 / month (includes heat, water, sewer)", source: "HOA documents" },
    { key: "pets", label: "Pets", displayValue: "Up to 2 pets allowed per HOA rules", source: "HOA documents" },
  ],
  documents: [
    {
      id: "h2-amenities",
      filename: "harbor-loft-amenities.pdf",
      title: "Realtor amenities form",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Entry",
          pageNumber: 1,
          zones: ["entry"],
          content:
            "Entry from a secured interior corridor. Original sliding barn door separates the entry from the main living space. Coat closet with built-in shoe storage.",
        },
        {
          title: "Kitchen",
          pageNumber: 1,
          zones: ["kitchen"],
          content:
            "Open galley kitchen along the brick wall. Flat-panel walnut cabinets, honed black soapstone counters, and open steel shelving. Gas cooktop with a ducted hood.",
        },
        {
          title: "Kitchen island",
          pageNumber: 2,
          zones: ["kitchen-island"],
          content:
            "Freestanding island with a butcher-block (maple) top, seats three, with a lower shelf for cookware. The island top was refinished with food-safe oil in 2024.",
        },
        {
          title: "Living room",
          pageNumber: 2,
          zones: ["living-room"],
          content:
            "Double-height living area with 14-foot ceilings, exposed brick, and original timber beams. Three oversized steel-frame windows face the harbor.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 3,
          zones: ["primary-bedroom"],
          content:
            "Primary bedroom on the mezzanine level, reached by a steel staircase. Glass guardrail overlooks the living room. Reach-in closet and adjacent full bath.",
        },
      ],
    },
    {
      id: "h2-hoa",
      filename: "hoa-summary.pdf",
      title: "HOA documents",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Fees and inclusions",
          pageNumber: 1,
          zones: [],
          content:
            "Monthly dues are $612 and cover heat (building boiler), water, sewer, trash, building insurance, and rooftop deck maintenance. Reserve study completed 2025.",
        },
        {
          title: "Rules",
          pageNumber: 3,
          zones: [],
          content:
            "Up to two pets per unit. Short-term rentals under 30 days are not permitted. Renovations affecting plumbing or structure require board approval.",
        },
      ],
    },
    {
      id: "h2-disclosure",
      filename: "seller-disclosure-summary.pdf",
      title: "Seller disclosure",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Systems and repairs",
          pageNumber: 2,
          zones: [],
          content:
            "Building masonry repointed in 2023 (HOA project). Unit water heater replaced 2022. Mini-split installed 2021. No known active leaks within the unit.",
        },
      ],
    },
    {
      id: "h2-neighborhood",
      filename: "neighborhood-notes.md",
      title: "Neighborhood guide",
      sourceKind: "manual_note",
      sections: [
        {
          title: "Nearby",
          zones: [],
          content:
            "The Port Wren ferry terminal is approximately 0.5 miles away. Harborfront Trail access is about 0.1 miles away. A grocery store is approximately 0.3 miles away.",
        },
      ],
    },
  ],
};

export const houses: House[] = [house1, house2];

export function getHouse(slug: string): House | undefined {
  return houses.find((h) => h.slug === slug);
}

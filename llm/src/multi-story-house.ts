import type { Box, House } from "./types";

// Fake realtor-supplied context for the demo. Listing details (address, price, makes and
// models, history) are fictional; only the 3D scan is real.
//
// 3D tour: the "2508 Paramount House" splat from superspl.at (scene 91c1e47e), streamed from its
// CDN, never copied into the repo (apps/web/tours/multi-story.json).
//
// Zones are in the viewer's world coordinates: x and z across the floor plan, y up. The camera
// starts in the ground-floor kitchen. Two storeys, read off the scan's collision voxels: the
// ground floor's walking surface is near y = 0 and the upper floor's near y = 3.3, so with the
// 1.5 m eye height the camera sits around y = 1.5 downstairs and y = 4.8 upstairs.
//
// Status: floors are mapped; rooms and objects are named (so documents can point at them) but
// have no boxes yet. They're placed from a walkthrough log (position, floor, heading, pitch, and
// "<thing> in <room>"), as for the Seven Park unit. Until then a question is answered with the
// floor the visitor is on.

/** Camera height (y) where the upper floor starts: above the stairs' midpoint. Refine from the log. */
const UPPER_FLOOR_FROM = 3.2;

/** The scan's x/z extent, with margin: a floor zone covers all of it. */
const X0 = -23;
const X1 = 26;
const Z0 = -14;
const Z1 = 25;

/** The camera-height range of each storey. */
const STOREY: Record<1 | 2, [number, number]> = { 1: [-3, UPPER_FLOOR_FROM], 2: [UPPER_FLOOR_FROM, 10] };

/**
 * A room's floor area on a storey: matched on x/z and on the camera's height, so a room
 * upstairs never matches a visitor standing under it.
 */
export const room = (storey: 1 | 2, x0: number, x1: number, z0: number, z1: number): Box => ({
  min: [x0, STOREY[storey][0], z0],
  max: [x1, STOREY[storey][1], z1],
});

/**
 * An object's box with its real height, in world metres (not above the floor: upstairs objects
 * start near y = 3.3). The camera's 3D view ray is cast against these.
 */
export const obj = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

export const multiStoryHouse: House = {
  id: "multi-story-house",
  slug: "multi-story-house",
  title: "Multi-Story House",
  address: "4127 Cedar Hollow Lane",
  city: "Austin",
  region: "TX",
  summary:
    "A light-filled two-story family home with an open kitchen and living area, a primary suite upstairs, a covered patio, and a big, shaded backyard.",
  zones: [
    { id: "property", name: "Whole property", kind: "property" },

    // Storeys: where you are until the rooms are mapped (and on the stairs, landings, hallways).
    { id: "floor-1", name: "Ground floor", kind: "floor", parentId: "property", aliases: ["first floor", "downstairs", "main floor"], boxes: [room(1, X0, X1, Z0, Z1)] },
    { id: "floor-2", name: "Upstairs", kind: "floor", parentId: "property", aliases: ["second floor", "upper floor"], boxes: [room(2, X0, X1, Z0, Z1)] },

    // Rooms (boxes come from the walkthrough log). Ground floor:
    { id: "entry", name: "Entry foyer", kind: "room", parentId: "floor-1", aliases: ["foyer", "front door", "entryway"] },
    { id: "living-room", name: "Living room", kind: "room", parentId: "floor-1", aliases: ["family room", "great room"] },
    { id: "kitchen", name: "Kitchen", kind: "room", parentId: "floor-1" },
    { id: "dining", name: "Dining room", kind: "room", parentId: "floor-1", aliases: ["dining area"] },
    { id: "office", name: "Study", kind: "room", parentId: "floor-1", aliases: ["office", "home office", "den"] },
    { id: "powder-room", name: "Powder room", kind: "room", parentId: "floor-1", aliases: ["half bath", "guest bathroom", "downstairs bathroom"] },
    { id: "laundry", name: "Laundry room", kind: "room", parentId: "floor-1", aliases: ["utility room", "mudroom"] },
    { id: "stairs", name: "Staircase", kind: "room", parentId: "floor-1", aliases: ["stairs", "stairway"] },
    { id: "patio", name: "Covered patio", kind: "outdoor_area", parentId: "floor-1", aliases: ["patio", "porch", "outside"] },
    { id: "backyard", name: "Backyard", kind: "outdoor_area", parentId: "floor-1", aliases: ["yard", "garden", "lawn"] },
    // Upstairs:
    { id: "game-room", name: "Game room", kind: "room", parentId: "floor-2", aliases: ["loft", "bonus room", "media room"] },
    { id: "primary-bedroom", name: "Primary bedroom", kind: "room", parentId: "floor-2", aliases: ["master bedroom", "primary suite"] },
    { id: "primary-bath", name: "Primary bathroom", kind: "room", parentId: "floor-2", aliases: ["en-suite", "master bathroom"] },
    { id: "primary-closet", name: "Walk-in closet", kind: "room", parentId: "floor-2", aliases: ["closet", "wardrobe"] },
    { id: "bedroom-2", name: "Second bedroom", kind: "room", parentId: "floor-2", aliases: ["bedroom 2"] },
    { id: "bedroom-3", name: "Third bedroom", kind: "room", parentId: "floor-2", aliases: ["bedroom 3"] },
    { id: "bedroom-4", name: "Fourth bedroom", kind: "room", parentId: "floor-2", aliases: ["bedroom 4", "guest room"] },
    { id: "hall-bath", name: "Hall bathroom", kind: "room", parentId: "floor-2", aliases: ["upstairs bathroom", "kids' bathroom", "jack and jill"] },

    // Objects (target boxes come from the walkthrough log).
    { id: "kitchen-island", name: "Island", kind: "feature", parentId: "kitchen", aliases: ["kitchen island", "breakfast bar"] },
    { id: "kitchen-range", name: "Range", kind: "appliance", parentId: "kitchen", aliases: ["stove", "oven", "cooktop", "burners"] },
    { id: "kitchen-hood", name: "Range hood", kind: "appliance", parentId: "kitchen", aliases: ["hood", "vent"] },
    { id: "kitchen-fridge", name: "Refrigerator", kind: "appliance", parentId: "kitchen", aliases: ["fridge", "freezer"] },
    { id: "kitchen-sink", name: "Sink", kind: "appliance", parentId: "kitchen", aliases: ["kitchen sink", "faucet", "dishwasher"] },
    { id: "kitchen-pantry", name: "Pantry", kind: "feature", parentId: "kitchen", aliases: ["walk-in pantry"] },
    { id: "kitchen-cabinets", name: "Cabinets", kind: "feature", parentId: "kitchen", aliases: ["kitchen cabinets", "counters", "backsplash"] },
    { id: "fireplace", name: "Fireplace", kind: "feature", parentId: "living-room", aliases: ["mantel", "hearth"] },
    { id: "living-tv", name: "TV wall", kind: "feature", parentId: "living-room", aliases: ["tv", "television"] },
    { id: "living-windows", name: "Back windows", kind: "feature", parentId: "living-room", aliases: ["windows", "view", "patio doors"] },
    { id: "dining-chandelier", name: "Chandelier", kind: "feature", parentId: "dining", aliases: ["light", "pendant", "dining light"] },
    { id: "office-built-ins", name: "Built-in shelves", kind: "feature", parentId: "office", aliases: ["shelves", "bookcase", "desk"] },
    { id: "washer-dryer", name: "Washer & dryer hookups", kind: "appliance", parentId: "laundry", aliases: ["washer", "dryer", "laundry"] },
    { id: "staircase-railing", name: "Stair railing", kind: "feature", parentId: "stairs", aliases: ["railing", "banister", "handrail"] },
    { id: "primary-bed-wall", name: "Bed wall", kind: "feature", parentId: "primary-bedroom", aliases: ["bed", "headboard"] },
    { id: "primary-windows", name: "Windows", kind: "feature", parentId: "primary-bedroom", aliases: ["view"] },
    { id: "primary-vanity", name: "Double vanity", kind: "feature", parentId: "primary-bath", aliases: ["vanity", "sinks", "mirror"] },
    { id: "primary-shower", name: "Shower", kind: "feature", parentId: "primary-bath", aliases: ["walk-in shower"] },
    { id: "primary-tub", name: "Soaking tub", kind: "feature", parentId: "primary-bath", aliases: ["tub", "bathtub"] },
    { id: "hall-bath-vanity", name: "Vanity", kind: "feature", parentId: "hall-bath", aliases: ["sink", "sinks", "mirror"] },
    { id: "hall-bath-tub", name: "Tub & shower", kind: "feature", parentId: "hall-bath", aliases: ["tub", "shower", "bathtub"] },
    { id: "powder-vanity", name: "Vanity", kind: "feature", parentId: "powder-room", aliases: ["sink", "mirror"] },
  ],
  // The walk-through: apps/web/tours/multi-story.json (content, collision, look, walk feel, floor plan).
  scene: { tour: "multi-story" },
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$1,285,000", source: "Listing basics form" },
    { key: "property_type", label: "Property type", displayValue: "Single-family home, two stories", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "4 (all upstairs)", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "2.5 (two full upstairs, a powder room downstairs)", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "3,240 sq ft (1,610 ground floor, 1,630 upstairs)", source: "County appraisal district record" },
    { key: "lot_size", label: "Lot", displayValue: "0.27 acre (11,760 sq ft)", source: "County appraisal district record" },
    { key: "year_built", label: "Year built", displayValue: "2016; kitchen and primary bath remodeled 2023", source: "County appraisal district record" },
    { key: "garage", label: "Garage", displayValue: "Attached two-car garage with EV charger (NEMA 14-50 outlet)", source: "Realtor amenities form" },
    { key: "flooring", label: "Flooring", displayValue: "Wide-plank white oak downstairs and on the stairs; carpet in the upstairs bedrooms; tile in baths and laundry", source: "Realtor amenities form" },
    { key: "ceiling_height", label: "Ceilings", displayValue: "10 ft ground floor, 9 ft upstairs; two-story ceiling over the entry", source: "Floor plan & dimensions" },
    { key: "countertop_material", label: "Countertops", displayValue: "Calacatta-look quartz (MSI Calacatta Laza) in the kitchen; quartz in all baths", source: "Appliance & fixture schedule" },
    {
      key: "appliances",
      label: "Kitchen appliances",
      displayValue: "48-inch Thermador Pro Grand dual-fuel range, Sub-Zero 36-inch built-in fridge, Bosch Benchmark dishwasher, Sharp microwave drawer",
      source: "Appliance & fixture schedule",
    },
    { key: "heating_type", label: "Heating & cooling", displayValue: "Two-zone central air with Carrier Infinity heat pumps (replaced 2022)", source: "Seller disclosure" },
    { key: "water_heater", label: "Water heater", displayValue: "Rinnai tankless gas water heater (2021)", source: "Seller disclosure" },
    { key: "roof", label: "Roof", displayValue: "Standing-seam metal, installed 2016", source: "Seller disclosure" },
    { key: "solar", label: "Solar", displayValue: "7.2 kW owned rooftop solar (no lease), Tesla Powerwall 2", source: "Seller disclosure" },
    { key: "property_tax", label: "Property tax", displayValue: "About $21,400 / year (2026 estimate)", source: "County appraisal district record" },
    { key: "hoa_fee", label: "HOA", displayValue: "$85 / month (common areas, pool, trails)", source: "HOA documents" },
    { key: "schools", label: "Schools", displayValue: "Cedar Hollow Elementary, Barton Ridge Middle, Live Oak Ridge High (verify boundaries)", source: "Neighborhood guide" },
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
            "Furniture, rugs, artwork, and decor shown in the 3D tour belong to the current owners and are not included in the sale. Light fixtures, window coverings, built-ins, and all kitchen appliances are included. The washer and dryer are negotiable.",
        },
        {
          title: "Layout",
          pageNumber: 1,
          zones: ["floor-1", "floor-2"],
          content:
            "Living spaces are downstairs and all four bedrooms are upstairs. On the ground floor, the entry foyer opens to a study on one side and the staircase on the other, and leads back to an open kitchen, dining, and living area along the back of the house, with a wall of windows onto the covered patio and backyard. The powder room and the laundry/mudroom (to the garage) are off the kitchen. Upstairs, a central game room connects the primary suite at one end with three secondary bedrooms and a hall bathroom at the other.",
        },
        {
          title: "Ground floor",
          pageNumber: 1,
          zones: ["floor-1"],
          content:
            "Wide-plank white oak floors throughout, 10-foot ceilings, recessed LED lighting on dimmers, and a two-story ceiling over the entry. The kitchen, dining room, and living room are open to each other.",
        },
        {
          title: "Upstairs",
          pageNumber: 1,
          zones: ["floor-2"],
          content:
            "Four bedrooms, two full bathrooms, and a game room. Carpet in the bedrooms, white oak in the game room and hallway, 9-foot ceilings, and a separate heating and cooling zone with its own thermostat.",
        },
        {
          title: "Entry foyer",
          pageNumber: 1,
          zones: ["entry"],
          content:
            "Two-story foyer with a glass-paneled oak front door, a coat closet, and an oversized drum pendant light. The study opens off one side and the staircase rises on the other.",
        },
        {
          title: "Staircase",
          pageNumber: 1,
          zones: ["stairs", "staircase-railing"],
          content:
            "Open staircase with white oak treads, painted risers, and a black steel railing with a white oak handrail. There's storage under the stairs, reached from the hallway.",
        },
        {
          title: "Living room",
          pageNumber: 2,
          zones: ["living-room"],
          content:
            "The living room sits at the back of the house, open to the kitchen and dining room, with a floor-to-ceiling window wall and a sliding door onto the covered patio.",
        },
        {
          title: "Fireplace",
          pageNumber: 2,
          zones: ["fireplace"],
          content: "Gas fireplace with a floor-to-ceiling limestone surround and a floating white oak mantel. It lights from a wall switch.",
        },
        {
          title: "Living room TV wall",
          pageNumber: 2,
          zones: ["living-tv"],
          content: "Pre-wired for a wall-mounted TV over the fireplace, with a recessed outlet, an HDMI conduit to a media closet, and in-ceiling speakers (5.1 surround, included).",
        },
        {
          title: "Back windows and patio doors",
          pageNumber: 2,
          zones: ["living-windows", "patio"],
          content: "Low-E double-pane window wall (Pella Lifestyle) with a 12-foot sliding door to the covered patio and motorized solar shades.",
        },
        {
          title: "Kitchen",
          pageNumber: 2,
          zones: ["kitchen"],
          content:
            "Remodeled in 2023: an open chef's kitchen with a large center island, white oak lower cabinets and white uppers to the ceiling, Calacatta-look quartz counters and a full-height quartz backsplash behind the range, and a walk-in pantry.",
        },
        {
          title: "Kitchen island",
          pageNumber: 2,
          zones: ["kitchen-island"],
          content: "Center island with seating for four on one side, a waterfall quartz edge, deep drawers, and outlets on both ends. It holds the main sink and dishwasher.",
        },
        {
          title: "Range and hood",
          pageNumber: 2,
          zones: ["kitchen-range", "kitchen-hood"],
          content: "A 48-inch dual-fuel pro range (six gas burners, a griddle, and two electric ovens) under a plaster-finish custom hood with a 1,000 CFM insert. There's a pot filler above the range.",
        },
        {
          title: "Refrigerator",
          pageNumber: 2,
          zones: ["kitchen-fridge"],
          content: "Panel-ready 36-inch built-in refrigerator with a bottom freezer, finished in white oak to match the cabinets.",
        },
        {
          title: "Kitchen sink",
          pageNumber: 2,
          zones: ["kitchen-sink"],
          content: "A 33-inch farmhouse sink in the island with a pull-down faucet, a filtered water tap, and a panel-ready dishwasher beside it.",
        },
        {
          title: "Pantry and cabinets",
          pageNumber: 2,
          zones: ["kitchen-pantry", "kitchen-cabinets"],
          content: "Walk-in pantry with wood shelving and a second counter for small appliances. Cabinets run to the ceiling with soft-close doors and drawers and under-cabinet lighting.",
        },
        {
          title: "Dining room",
          pageNumber: 2,
          zones: ["dining", "dining-chandelier"],
          content: "Dining room between the kitchen and the living room, open to both. Seats eight under a linen drum chandelier (included).",
        },
        {
          title: "Study",
          pageNumber: 3,
          zones: ["office", "office-built-ins"],
          content: "Study at the front of the house with glass French doors, floor-to-ceiling built-in white oak shelves, a built-in desk, and hardwired ethernet.",
        },
        {
          title: "Powder room",
          pageNumber: 3,
          zones: ["powder-room", "powder-vanity"],
          content: "Powder room off the kitchen hallway with a floating vanity, a vessel sink, and patterned cement tile.",
        },
        {
          title: "Laundry and mudroom",
          pageNumber: 3,
          zones: ["laundry", "washer-dryer"],
          content: "Laundry room with a utility sink, folding counter, upper cabinets, and a bench with cubbies by the door to the garage. Side-by-side washer and dryer hookups (gas or electric dryer).",
        },
        {
          title: "Covered patio",
          pageNumber: 3,
          zones: ["patio"],
          content: "Covered stone patio across the back of the house with a cedar-plank ceiling, two ceiling fans, a gas line ready for an outdoor grill, and string-light hooks.",
        },
        {
          title: "Backyard",
          pageNumber: 3,
          zones: ["backyard"],
          content: "Flat, fully fenced backyard with mature live oaks for shade, a lawn, raised garden beds, and a drip irrigation system. There's room for a pool (the seller has an engineer's sketch).",
        },
        {
          title: "Game room",
          pageNumber: 4,
          zones: ["game-room"],
          content: "Open game room at the top of the stairs, between the primary suite and the other bedrooms, pre-wired for a TV and surround sound.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 4,
          zones: ["primary-bedroom", "primary-bed-wall", "primary-windows"],
          content: "Primary bedroom at the quiet back corner of the upstairs, with a tray ceiling, a ceiling fan, and windows on two sides looking over the backyard trees. Fits a king bed with nightstands.",
        },
        {
          title: "Walk-in closet",
          pageNumber: 4,
          zones: ["primary-closet"],
          content: "Walk-in closet through the primary bathroom with custom shelving, double hanging rods, and a center dresser island.",
        },
        {
          title: "Primary bathroom",
          pageNumber: 4,
          zones: ["primary-bath", "primary-vanity", "primary-shower", "primary-tub"],
          content: "Remodeled in 2023: a double vanity with quartz top, a freestanding soaking tub under the window, a frameless glass walk-in shower with a rain head, heated tile floors, and a separate water closet.",
        },
        {
          title: "Secondary bedrooms",
          pageNumber: 4,
          zones: ["bedroom-2", "bedroom-3", "bedroom-4"],
          content: "Three secondary bedrooms upstairs, each with a ceiling fan and a reach-in closet; the fourth bedroom is the largest and works as a guest room.",
        },
        {
          title: "Hall bathroom",
          pageNumber: 4,
          zones: ["hall-bath", "hall-bath-vanity", "hall-bath-tub"],
          content: "Full hall bathroom shared by the secondary bedrooms, with a double vanity and a tub-shower combination.",
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
            "3,240 sq ft of living space on two floors (1,610 sq ft ground floor, 1,630 sq ft upstairs), plus a 460 sq ft attached two-car garage and a 380 sq ft covered patio. Ceilings: 10 ft downstairs, 9 ft upstairs, 19 ft over the entry. Room measurements are approximate and taken at the widest points.",
        },
        { title: "Entry foyer", pageNumber: 1, zones: ["entry"], content: "Entry foyer: 9 ft × 12 ft, two-story ceiling (about 19 ft)." },
        { title: "Study", pageNumber: 1, zones: ["office"], content: "Study: 11 ft × 12 ft. The built-in shelves are 10 ft wide and 14 in deep." },
        { title: "Living room", pageNumber: 1, zones: ["living-room", "fireplace", "living-windows"], content: "Living room: 18 ft × 17 ft. Fireplace surround 7 ft wide. Window wall 16 ft wide with a 12-ft sliding door." },
        { title: "Kitchen", pageNumber: 1, zones: ["kitchen", "kitchen-island", "kitchen-pantry"], content: "Kitchen: 16 ft × 14 ft. Island 10 ft × 4 ft 6 in with 3 ft 6 in walkways around it. Walk-in pantry 5 ft × 6 ft." },
        { title: "Dining room", pageNumber: 1, zones: ["dining"], content: "Dining room: 13 ft × 12 ft; fits a 96-inch table." },
        { title: "Powder room and laundry", pageNumber: 1, zones: ["powder-room", "laundry"], content: "Powder room: 5 ft × 6 ft. Laundry/mudroom: 8 ft × 9 ft." },
        { title: "Staircase", pageNumber: 1, zones: ["stairs"], content: "Staircase: 16 risers, 3 ft 8 in wide, with a landing at the turn." },
        { title: "Patio and yard", pageNumber: 1, zones: ["patio", "backyard"], content: "Covered patio: 32 ft × 12 ft. Backyard: about 70 ft deep by 85 ft wide." },
        { title: "Game room", pageNumber: 2, zones: ["game-room"], content: "Game room: 17 ft × 15 ft." },
        { title: "Primary suite", pageNumber: 2, zones: ["primary-bedroom", "primary-bath", "primary-closet"], content: "Primary bedroom: 17 ft × 15 ft. Primary bathroom: 13 ft × 11 ft (shower 6 ft × 4 ft, tub 67 in). Walk-in closet: 10 ft × 8 ft." },
        { title: "Secondary bedrooms", pageNumber: 2, zones: ["bedroom-2", "bedroom-3", "bedroom-4"], content: "Second bedroom: 12 ft × 11 ft. Third bedroom: 12 ft × 12 ft. Fourth bedroom: 14 ft × 12 ft. Each closet is 6 ft wide." },
        { title: "Hall bathroom", pageNumber: 2, zones: ["hall-bath"], content: "Hall bathroom: 10 ft × 8 ft, with a 60-inch tub." },
      ],
    },
    {
      id: "msh-appliances",
      filename: "appliance-and-fixture-schedule.pdf",
      title: "Appliance & fixture schedule",
      sourceKind: "realtor_upload",
      sections: [
        { title: "Range", pageNumber: 1, zones: ["kitchen-range"], content: "Thermador Pro Grand 48-inch dual-fuel range (PRD486WDHU): six Star burners, a griddle, a 4.6 cu ft convection oven, and a 2.5 cu ft secondary oven. Installed 2023." },
        { title: "Range hood", pageNumber: 1, zones: ["kitchen-hood"], content: "Custom plaster hood with a Zephyr 1,000 CFM insert, LED task lights, and a Brizo pot filler above the range." },
        { title: "Refrigerator", pageNumber: 1, zones: ["kitchen-fridge"], content: "Sub-Zero Classic 36-inch panel-ready built-in refrigerator with bottom freezer and ice maker (CL3650UFD/O). Installed 2023." },
        { title: "Sink and dishwasher", pageNumber: 1, zones: ["kitchen-sink"], content: "Kohler Whitehaven 33-inch farmhouse sink, Brizo Litze pull-down faucet in brushed brass, Bosch Benchmark panel-ready dishwasher (SHV9PCM3N), and a 1/2 HP garbage disposal." },
        { title: "Microwave", pageNumber: 1, zones: ["kitchen-island"], content: "Sharp 24-inch microwave drawer (SMD2499FS) in the island." },
        { title: "Counters and cabinetry", pageNumber: 1, zones: ["kitchen-cabinets", "kitchen-island", "kitchen-pantry"], content: "MSI Calacatta Laza quartz, 3 cm, with a mitered waterfall on the island. Custom rift-sawn white oak lowers, painted shaker uppers (Sherwin-Williams Alabaster), Blum soft-close hardware." },
        { title: "Fireplace", pageNumber: 2, zones: ["fireplace"], content: "Heat & Glo 6000 gas fireplace insert with a limestone surround. Serviced annually; last service March 2026." },
        { title: "Laundry", pageNumber: 2, zones: ["washer-dryer"], content: "Hookups for a side-by-side washer and a gas or electric dryer; the current LG washer and dryer (2022) are negotiable." },
        { title: "Primary bathroom", pageNumber: 2, zones: ["primary-vanity", "primary-shower", "primary-tub"], content: "Kohler Caxton undermount sinks, Delta Trinsic faucets, a Victoria + Albert Barcelona freestanding tub, a Kohler rain shower head with a hand shower, and Nuheat electric floor heating on a programmable thermostat." },
        { title: "Other bathrooms", pageNumber: 2, zones: ["hall-bath-vanity", "hall-bath-tub", "powder-vanity"], content: "TOTO Drake toilets throughout. Hall bath: quartz double vanity and a Kohler Archer tub-shower. Powder room: a floating oak vanity with a vessel sink." },
        { title: "Lighting", pageNumber: 2, zones: ["dining-chandelier", "entry"], content: "Lutron Caséta smart dimmers on the main floor. Dining chandelier: Visual Comfort linen drum, 36-inch. Entry pendant: 30-inch drum on a 9-ft rod." },
        { title: "Whole-home systems", pageNumber: 3, zones: [], content: "Two Carrier Infinity heat pumps (2022) with Ecobee thermostats, one per floor. Rinnai RU199iN tankless gas water heater (2021). 7.2 kW owned rooftop solar with a Tesla Powerwall 2. Whole-house water softener. Cat 6 wiring to every bedroom and the study. A Ring doorbell and three outdoor cameras convey." },
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
            "Both HVAC units replaced in 2022 (10-year parts warranty, transferable). Tankless water heater installed 2021. Standing-seam metal roof from original construction in 2016; no known leaks. Foundation: post-tension slab; one minor cosmetic crack in the garage floor, no structural issues per a 2025 inspection. No known flooding; the lot is outside the 100-year floodplain.",
        },
        {
          title: "Remodel and permits",
          pageNumber: 1,
          zones: ["kitchen", "primary-bath"],
          content: "The 2023 kitchen and primary bathroom remodel was permitted and finaled with the City of Austin. Contractor warranty on workmanship runs through 2028.",
        },
        {
          title: "Solar",
          pageNumber: 1,
          zones: [],
          content: "The 7.2 kW solar system and Powerwall are owned outright (no lease or loan) and transfer with the house. Average electric bill over the last 12 months: $64/month.",
        },
      ],
    },
    {
      id: "msh-hoa",
      filename: "hoa-summary.pdf",
      title: "HOA documents",
      sourceKind: "realtor_upload",
      sections: [
        { title: "Fees and amenities", pageNumber: 1, zones: [], content: "Cedar Hollow HOA: $85/month. Covers common-area landscaping, the community pool and cabana, 3 miles of walking trails, and a playground." },
        { title: "Rules", pageNumber: 1, zones: ["backyard", "patio"], content: "Fences up to 6 ft and pools are allowed with architectural review (usually approved within 30 days). Short-term rentals under 30 days are not allowed." },
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
            "Quiet cul-de-sac street. About 15 minutes to downtown Austin and 10 minutes to the Barton Creek Greenbelt trailhead. Walking distance to the community pool and trails. Grocery stores and coffee shops within 2 miles. Zoned schools: Cedar Hollow Elementary, Barton Ridge Middle, Live Oak Ridge High (buyers should verify boundaries with the district).",
        },
      ],
    },
  ],
};

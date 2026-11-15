import type { Box, House } from "./types";

// Fake realtor-supplied context for the demo. Listing details are fictional.

/**
 * A full-height box over a floor area, in scene metres. Zones only need the
 * footprint: the walking camera's height is fixed.
 */
const area = (x0: number, x1: number, z0: number, z1: number): Box => ({ min: [x0, -1, z0], max: [x1, 3, z1] });

/**
 * An object's box with its real height, in scene metres (floor = 0). The
 * camera's 3D view ray is cast against these, so height matters: look level
 * and you see what's at eye height (cabinets, a TV, a doorway); look down for
 * low things (a sink, a bed, a nightstand).
 */
const obj = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

// 3D tour: the "Seven Park - Miami - Unit" splat, streamed from superspl.at
// (see engine/scripts/fetch-sample.sh). The scan is copyrighted, so it's
// streamed, never copied into the repo. Listing details are fictional; the
// living room text matches the scene's preview.
//
// Zones are in the viewer's world coordinates: x across, z along the unit,
// floor at y = 0 (the camera starts in the dining area facing +z, toward the
// living room windows).
// - Room boxes were read off the scene's walk-mode collision voxels (a
//   top-down height map of walls, counters, beds and furniture).
// - Object (target) boxes come from a walkthrough log (camera position +
//   heading + "<thing> in <room>"): each logged view ray was cast across the
//   collision voxels, and the box sits on the object it hit. Heights come from
//   the voxels inside each box (the collision data stops ~1.5 m, so anything
//   solid that high is treated as floor-to-ceiling).
// - Entrance boxes sit on the logged doorway positions.
// Check and adjust with the camera readout on the tour page (Corner 1 /
// Corner 2 give a ready-made area(...) call).
const house3: House = {
  id: "house-3",
  slug: "house-3",
  title: "Miami Park View Residence",
  address: "700 Park View Drive, Unit 1204",
  city: "Miami",
  region: "FL",
  summary:
    "A bright, newly built condo with floor-to-ceiling windows, a private balcony with city views, wide-plank light wood floors, and full-service building amenities.",
  zones: [
    { id: "property", name: "Whole property", kind: "property" },

    // Rooms: where you stand. opensTo = rooms open plan with this one (no wall between;
    // the balcony counts, through the glass). Rooms behind a door are seen from the
    // doorway itself: standing in an entrance zone sees into the rooms on both sides.
    { id: "kitchen", name: "Kitchen", kind: "room", parentId: "property", boxes: [area(-5.6, -1.8, -3.9, -1.25)], opensTo: ["dining"] },
    {
      id: "dining",
      name: "Dining area",
      kind: "room",
      parentId: "property",
      aliases: ["dining room"],
      boxes: [area(-1.8, 1.25, -3.7, 0)],
      opensTo: ["living-room", "hallway"],
    },
    {
      id: "living-room",
      name: "Living room",
      kind: "room",
      parentId: "property",
      aliases: ["living area", "lounge"],
      boxes: [area(-1.7, 1.25, 0, 3.85)],
      opensTo: ["balcony"],
    },
    {
      id: "hallway",
      name: "Hallway",
      kind: "room",
      parentId: "property",
      aliases: ["hall", "corridor"],
      // The hall between the second bathroom's door and the storage closet,
      // plus the short corridor down to the second bedroom.
      boxes: [area(-2.9, -1.6, -1.15, 0.25), area(-2.7, -1.9, 0.25, 1.15)],
    },
    {
      id: "secondary-bath",
      name: "Second bathroom",
      kind: "room",
      parentId: "property",
      aliases: ["guest bathroom", "hall bathroom", "secondary bathroom"],
      boxes: [area(-5.6, -2.9, -1.15, 0.25)],
    },
    {
      id: "bedroom-2",
      name: "Second bedroom",
      kind: "room",
      parentId: "property",
      aliases: ["guest bedroom", "secondary bedroom", "bedroom 2"],
      boxes: [area(-5.4, -1.7, 1.15, 3.85)],
      opensTo: ["balcony"],
    },
    {
      id: "primary-bedroom",
      name: "Primary bedroom",
      kind: "room",
      parentId: "property",
      aliases: ["master bedroom", "main bedroom"],
      // The bedroom plus its walk-in closet (the L running north to the bathroom door).
      boxes: [area(1.25, 4.75, 0, 3.85), area(1.25, 3.0, -2.8, 0)],
      opensTo: ["balcony"],
    },
    { id: "primary-bath", name: "Primary bathroom", kind: "room", parentId: "property", aliases: ["en-suite", "master bathroom"], boxes: [area(3.0, 5.05, -3.9, 0)] },
    // Runs along the whole south side, outside the living room and both bedrooms.
    { id: "balcony", name: "Balcony", kind: "outdoor_area", parentId: "property", aliases: ["terrace", "outside"], boxes: [area(-5.6, 5.05, 3.85, 4.6)] },

    // Entrances: position only (the doorway you're standing in), whichever way you face.
    { id: "primary-bedroom-entrance", name: "Entrance", kind: "entrance", parentId: "primary-bedroom", aliases: ["bedroom door"], boxes: [area(0.95, 1.6, 0.2, 1.0)] },
    { id: "primary-bath-entrance", name: "Doorway", kind: "entrance", parentId: "primary-bath", aliases: ["bathroom door"], boxes: [area(3.0, 3.6, -0.75, -0.05)] },
    { id: "secondary-bath-entrance", name: "Entrance", kind: "entrance", parentId: "secondary-bath", aliases: ["bathroom door"], boxes: [area(-3.05, -2.55, -0.45, 0.2)] },
    { id: "bedroom-2-entrance", name: "Entrance", kind: "entrance", parentId: "bedroom-2", aliases: ["bedroom door"], boxes: [area(-2.65, -1.85, 0.3, 1.2)] },

    // Objects: 3D boxes on the things themselves (obj(x0, x1, z0, z1, bottom, top)).
    // The camera's 3D view ray is cast against these; the first hit is what
    // you're facing. Where two are hit at the same spot the smaller wins, so the
    // tall counter runs (counters + upper cabinets) are fallbacks behind the
    // appliances set into them. Tops: floor-to-ceiling cabinetry 2.4 m, glass
    // 2.6 m, showers 2.2 m, vanities with mirrors 2.0 m, low furniture by voxel height.

    // Kitchen: back (south) counter and main (north) run, either side of the galley aisle.
    { id: "kitchen-sink", name: "Sink", kind: "appliance", parentId: "kitchen", aliases: ["kitchen sink", "faucet"], target: [obj(-3.1, -2.3, -1.95, -1.4, 0, 1.2)] },
    // The kitchen has two stoves, one on each side of the galley.
    { id: "kitchen-stove", name: "Stove (back counter)", kind: "appliance", parentId: "kitchen", aliases: ["stove", "stovetop", "burners"], target: [obj(-4.8, -3.95, -1.95, -1.4, 0, 1.1)] },
    { id: "kitchen-oven-range", name: "Oven range", kind: "appliance", parentId: "kitchen", aliases: ["oven", "range"], target: [obj(-5.1, -4.3, -3.4, -2.9, 0, 2.4)] },
    { id: "kitchen-stove-main", name: "Stove (main run)", kind: "appliance", parentId: "kitchen", aliases: ["stove", "second stove", "cooktop"], target: [obj(-3.9, -3.1, -3.4, -2.9, 0, 1.1)] },
    { id: "kitchen-cabinets", name: "Tall cabinets", kind: "feature", parentId: "kitchen", aliases: ["cabinets", "pantry"], target: [obj(-3.0, -2.0, -3.4, -2.9, 0, 2.4)] },
    // Each run is base cabinets + counter (to 1.0 m) and shallower upper cabinets (from 1.45 m),
    // with the open backsplash gap between: a level look lands on the uppers, a moderate
    // downward look passes under them to the sink or stove set into the counter.
    {
      id: "kitchen-back-counter",
      name: "Back counter",
      kind: "feature",
      parentId: "kitchen",
      aliases: ["counters", "countertop", "cabinets"],
      target: [obj(-5.55, -1.8, -1.95, -1.3, 0, 1.0), obj(-5.55, -1.8, -1.65, -1.3, 1.45, 2.4)],
    },
    {
      id: "kitchen-main-counter",
      name: "Main counter run",
      kind: "feature",
      parentId: "kitchen",
      aliases: ["counters", "countertop", "cabinets"],
      target: [obj(-5.55, -1.8, -3.4, -2.9, 0, 1.0), obj(-5.55, -1.8, -3.4, -3.05, 1.45, 2.4)],
    },

    { id: "dining-table", name: "Dining table", kind: "feature", parentId: "dining", aliases: ["table"], target: [obj(-0.75, 0.35, -1.8, -0.7, 0, 0.8)] },

    // TV on the wall above a media shelf, logged from the same spot looking up vs down.
    // Voxels: shelf x 0.85-1.1 up to ~0.75 m; TV on the wall face at x ~1.15 from ~0.85 m.
    { id: "living-tv", name: "TV", kind: "feature", parentId: "living-room", aliases: ["television", "tv wall"], target: [obj(0.95, 1.25, 1.15, 3.45, 0.8, 2.2)] },
    { id: "living-shelf", name: "Media shelf", kind: "feature", parentId: "living-room", aliases: ["shelf", "media console", "console"], target: [obj(0.6, 1.15, 1.15, 3.45, 0, 0.8)] },
    { id: "couch", name: "Couch", kind: "feature", parentId: "living-room", aliases: ["sofa", "sectional"], target: [obj(-1.7, -0.2, 0.4, 3.4, 0, 0.85)] },
    { id: "living-balcony-door", name: "Balcony door", kind: "feature", parentId: "living-room", aliases: ["windows", "balcony", "view"], target: [obj(-1.7, 1.25, 3.8, 4.05, 0, 2.6)] },
    // Physically at the dining/hallway end, but seen (and logged) from the living room.
    { id: "storage-closet", name: "Storage closet", kind: "feature", parentId: "living-room", aliases: ["closet", "storage"], target: [obj(-2.8, -1.6, -0.95, -0.4, 0, 2.4)] },

    { id: "primary-bed", name: "Bed", kind: "feature", parentId: "primary-bedroom", aliases: ["bed"], target: [obj(2.4, 4.6, 1.0, 3.05, 0, 0.75)] },
    // TV standing on a dresser. Voxels: dresser x 1.45-1.8 up to ~0.75 m; the TV is a thin
    // slab at the wall side (x ~1.45-1.5) from ~0.8 m. Keeping the TV box thin is what lets
    // a downward look land on the dresser top in front of it.
    { id: "primary-tv", name: "TV", kind: "feature", parentId: "primary-bedroom", aliases: ["television"], target: [obj(1.3, 1.55, 1.3, 2.7, 0.78, 2.2)] },
    { id: "primary-dresser", name: "Dresser", kind: "feature", parentId: "primary-bedroom", aliases: ["drawers", "chest of drawers"], target: [obj(1.3, 1.9, 1.3, 2.7, 0, 0.78)] },
    { id: "primary-nightstand", name: "Nightstand", kind: "feature", parentId: "primary-bedroom", aliases: ["bedside table"], target: [obj(4.1, 4.7, 0.3, 0.9, 0, 0.65)] },
    { id: "primary-balcony-door", name: "Balcony door", kind: "feature", parentId: "primary-bedroom", aliases: ["windows", "balcony"], target: [obj(1.25, 4.75, 3.8, 4.05, 0, 2.6)] },
    { id: "primary-closet", name: "Closet", kind: "feature", parentId: "primary-bedroom", aliases: ["walk-in closet", "wardrobe", "shelving"], target: [obj(1.25, 2.2, -2.8, -0.4, 0, 2.4)] },

    { id: "primary-shower", name: "Shower", kind: "feature", parentId: "primary-bath", aliases: ["walk-in shower"], target: [obj(3.5, 5.05, -3.9, -2.9, 0, 2.2)] },
    // Left edge kept at 4.2 so the logged shower ray (from the vanity side) passes it.
    { id: "primary-toilet", name: "Toilet", kind: "feature", parentId: "primary-bath", target: [obj(4.2, 4.8, -2.6, -1.95, 0, 0.8)] },
    { id: "primary-vanity", name: "Sink & mirror", kind: "feature", parentId: "primary-bath", aliases: ["vanity", "sinks", "mirror"], target: [obj(4.1, 4.85, -1.85, -0.35, 0, 2)] },

    { id: "secondary-shower", name: "Shower", kind: "feature", parentId: "secondary-bath", target: [obj(-5.55, -4.7, -1.0, 0.2, 0, 2.2)] },
    { id: "secondary-toilet", name: "Toilet", kind: "feature", parentId: "secondary-bath", target: [obj(-4.35, -3.75, -1.1, -0.55, 0, 0.8)] },
    { id: "secondary-vanity", name: "Sink & mirror", kind: "feature", parentId: "secondary-bath", aliases: ["vanity", "sink", "mirror"], target: [obj(-3.65, -2.95, -0.95, -0.45, 0, 2)] },

    // Right edge kept at -3.05 so the logged balcony ray passes the bed's corner.
    // 0.75 m high: a level look passes over it to the closet behind; looking down lands on it.
    { id: "bedroom-2-bed", name: "Bed", kind: "feature", parentId: "bedroom-2", aliases: ["bed"], target: [obj(-5.05, -3.05, 1.75, 3.5, 0, 0.75)] },
    // TV above a dresser, logged from the same spot looking up vs down.
    // Voxels: dresser x -2.2..-1.95 up to ~0.6-0.85 m; the TV itself isn't in the collision data,
    // so it's a thin slab on the wall behind the dresser (x -1.95..-1.7).
    { id: "bedroom-2-tv", name: "TV", kind: "feature", parentId: "bedroom-2", aliases: ["television"], target: [obj(-1.95, -1.7, 1.7, 3.4, 0.85, 2.2)] },
    { id: "bedroom-2-dresser", name: "Dresser", kind: "feature", parentId: "bedroom-2", aliases: ["drawers", "chest of drawers"], target: [obj(-2.25, -1.7, 1.7, 3.4, 0, 0.85)] },
    { id: "bedroom-2-nightstand", name: "Nightstand", kind: "feature", parentId: "bedroom-2", aliases: ["bedside table"], target: [obj(-5.2, -4.75, 1.3, 1.85, 0, 0.65)] },
    // The wardrobe strip on the north wall, behind the bed: a level look over the bed reaches it.
    { id: "bedroom-2-closet", name: "Closet", kind: "feature", parentId: "bedroom-2", aliases: ["wardrobe"], target: [obj(-5.2, -3.4, 0.75, 1.2, 0, 2.4)] },
    { id: "bedroom-2-balcony-door", name: "Balcony door", kind: "feature", parentId: "bedroom-2", aliases: ["windows", "balcony"], target: [obj(-5.4, -1.7, 3.8, 4.05, 0, 2.6)] },
  ],
  scene: {
    contentUrl: "https://d28zzqy0iyovbz.cloudfront.net/b185fd52/v1/meta.json",
    settingsUrl: "/scenes/seven-park/settings.json",
    collisionUrl: "https://d28zzqy0iyovbz.cloudfront.net/b185fd52/v1/scene.voxel.json",
    aa: false,
    credit: "3D scan: “Seven Park – Miami – Unit” by sa3d, © stepinc.co, streamed from superspl.at",
  },
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$865,000", source: "Listing basics form" },
    { key: "property_type", label: "Property type", displayValue: "Condominium, 12th floor", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "2", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "2", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "960 sq ft", source: "Condo declaration" },
    { key: "balcony_sqft", label: "Balcony", displayValue: "110 sq ft", source: "Condo declaration" },
    { key: "year_built", label: "Year built", displayValue: "2025 (new construction)", source: "County assessor record" },
    { key: "flooring", label: "Flooring", displayValue: "Wide-plank light oak engineered wood in living areas and bedrooms", source: "Realtor amenities form" },
    { key: "ceiling_height", label: "Ceilings", displayValue: "9 ft 6 in", source: "Realtor amenities form" },
    { key: "windows", label: "Windows", displayValue: "Floor-to-ceiling impact-resistant glass", source: "Realtor amenities form" },
    { key: "countertop_material", label: "Countertops", displayValue: "White quartz (Caesarstone Pure White)", source: "Appliance & fixture schedule" },
    {
      key: "appliances",
      label: "Kitchen appliances",
      displayValue: "Two 30-inch induction cooktops (Bosch Benchmark, Miele), Bosch 800 Series wall oven and dishwasher",
      source: "Appliance & fixture schedule",
    },
    { key: "heating_type", label: "Heating & cooling", displayValue: "Central air conditioning and heat pump", source: "Seller disclosure" },
    { key: "parking", label: "Parking", displayValue: "1 assigned garage space", source: "Condo declaration" },
    { key: "hoa_fee", label: "HOA", displayValue: "$780 / month", source: "HOA documents" },
    { key: "pets", label: "Pets", displayValue: "Up to 2 pets allowed per HOA rules", source: "HOA documents" },
  ],
  documents: [
    {
      id: "h3-amenities",
      filename: "park-view-amenities.pdf",
      title: "Realtor amenities form",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Staging",
          pageNumber: 1,
          zones: [],
          content:
            "Furniture, artwork, and decor shown in the 3D tour are virtual staging to show scale and layout. They are not included in the sale. Light fixtures, built-ins, and appliances are included.",
        },
        {
          title: "Layout",
          pageNumber: 1,
          zones: [],
          content:
            "Split-bedroom layout: the kitchen, dining area, and living room are open to each other in the middle of the unit, with the primary suite on one side and the second bedroom and second bathroom on the other. A private balcony runs along the full window side, reached from the living room and both bedrooms.",
        },
        {
          title: "Living room",
          pageNumber: 1,
          zones: ["living-room"],
          content:
            "Open living room with floor-to-ceiling windows, recessed ceiling lights, and a statement ring chandelier. Wide-plank light oak floors. The primary bedroom opens off the living room.",
        },
        {
          title: "Living room TV wall",
          pageNumber: 1,
          zones: ["living-tv"],
          content:
            "Wall pre-wired for a mounted TV, with power and a recessed cable box behind the screen. The TV hangs above the media shelf. The TV shown is staging.",
        },
        {
          title: "Living room media shelf",
          pageNumber: 1,
          zones: ["living-shelf"],
          content: "Built-in floating media shelf in light oak, mounted below the TV, with a cable channel and outlets behind it.",
        },
        {
          title: "Living room seating",
          pageNumber: 1,
          zones: ["couch"],
          content: "The seating wall fits an L-shaped sectional (shown staged) with room for a coffee table between the couch and the TV.",
        },
        {
          title: "Living room balcony door",
          pageNumber: 1,
          zones: ["living-balcony-door"],
          content: "Floor-to-ceiling impact-resistant glass with a sliding door to the balcony and motorized shades.",
        },
        {
          title: "Storage closet",
          pageNumber: 1,
          zones: ["storage-closet"],
          content: "Full-height storage closet off the living area with adjustable shelving and a coat rod.",
        },
        {
          title: "Balcony",
          pageNumber: 1,
          zones: ["balcony"],
          content: "Private balcony running the full width of the unit, with a glass-and-metal railing and open city views from the 12th floor.",
        },
        {
          title: "Dining area",
          pageNumber: 1,
          zones: ["dining"],
          content: "Dining area between the kitchen and the living room, open to both, with recessed lighting.",
        },
        {
          title: "Dining table spot",
          pageNumber: 1,
          zones: ["dining-table"],
          content: "Fits a round table for four (shown staged). A ceiling junction box over the table is ready for a pendant light.",
        },
        {
          title: "Kitchen",
          pageNumber: 2,
          zones: ["kitchen"],
          content:
            "Galley kitchen with counter runs on both sides, opening onto the dining area, with two stoves (one on each run). Flat-panel European-style cabinetry, white quartz countertops, and stainless steel appliances.",
        },
        {
          title: "Kitchen sink",
          pageNumber: 2,
          zones: ["kitchen-sink"],
          content: "Undermount stainless steel sink on the back counter with a pull-down faucet and a built-in dishwasher beside it.",
        },
        {
          title: "Back counter stove",
          pageNumber: 2,
          zones: ["kitchen-stove"],
          content: "The first of the kitchen's two stoves: a 30-inch induction stovetop set into the back counter, with a slim recirculating hood above.",
        },
        {
          title: "Oven range",
          pageNumber: 2,
          zones: ["kitchen-oven-range"],
          content: "Built-in convection wall oven at eye level in a tall cabinet column at the end of the main counter run.",
        },
        {
          title: "Main run stove",
          pageNumber: 2,
          zones: ["kitchen-stove-main"],
          content: "The kitchen's second stove, on the main counter run near the wall oven: a 30-inch induction stovetop, so two people can cook at once.",
        },
        {
          title: "Tall cabinets",
          pageNumber: 2,
          zones: ["kitchen-cabinets"],
          content: "Floor-to-ceiling pantry cabinets at the dining end of the main run, with pull-out shelves.",
        },
        {
          title: "Kitchen counters",
          pageNumber: 2,
          zones: ["kitchen-back-counter", "kitchen-main-counter"],
          content: "White quartz counters on both runs, with soft-close drawers below and under-cabinet LED lighting.",
        },
        {
          title: "Second bathroom",
          pageNumber: 2,
          zones: ["secondary-bath", "secondary-bath-entrance"],
          content: "Full second bathroom off the hallway, near the second bedroom, with porcelain tile floors.",
        },
        {
          title: "Second bathroom fixtures",
          pageNumber: 2,
          zones: ["secondary-shower", "secondary-toilet", "secondary-vanity"],
          content: "Glass-enclosed shower, a wall-hung toilet, and a single-sink vanity with a quartz top and a mirror cabinet.",
        },
        {
          title: "Second bedroom",
          pageNumber: 3,
          zones: ["bedroom-2", "bedroom-2-entrance"],
          content: "Second bedroom with floor-to-ceiling windows, light oak floors, and its own door to the balcony. Fits a queen bed (shown staged).",
        },
        {
          title: "Second bedroom closet",
          pageNumber: 3,
          zones: ["bedroom-2-closet"],
          content: "Reach-in wardrobe closet with sliding doors along the wall behind the bed.",
        },
        {
          title: "Second bedroom TV",
          pageNumber: 3,
          zones: ["bedroom-2-tv"],
          content: "The wall facing the bed has power and a cable outlet at TV height for a wall-mounted TV (the TV shown is staging).",
        },
        {
          title: "Second bedroom dresser",
          pageNumber: 3,
          zones: ["bedroom-2-dresser"],
          content: "The wall facing the bed fits a full-width dresser (shown staged) under the TV.",
        },
        {
          title: "Second bedroom details",
          pageNumber: 3,
          zones: ["bedroom-2-bed", "bedroom-2-nightstand", "bedroom-2-balcony-door"],
          content: "Room for a queen bed with nightstands (shown staged) and a sliding glass door to the balcony.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 3,
          zones: ["primary-bedroom", "primary-bedroom-entrance"],
          content:
            "Primary bedroom off the living room with floor-to-ceiling windows, light oak floors, and its own door to the balcony. A walk-in closet leads through to the en-suite bathroom.",
        },
        {
          title: "Primary bedroom bed wall",
          pageNumber: 3,
          zones: ["primary-bed", "primary-nightstand"],
          content: "Fits a king bed with nightstands on both sides (shown staged), with outlets and reading-light junction boxes at each side.",
        },
        {
          title: "Primary bedroom TV",
          pageNumber: 3,
          zones: ["primary-tv"],
          content: "Power and a cable outlet above dresser height on the wall facing the bed, for a TV (the TV shown is staging).",
        },
        {
          title: "Primary bedroom dresser",
          pageNumber: 3,
          zones: ["primary-dresser"],
          content: "The wall facing the bed fits a wide dresser (shown staged), with the TV above it.",
        },
        {
          title: "Primary bedroom balcony door",
          pageNumber: 3,
          zones: ["primary-balcony-door"],
          content: "Sliding glass door from the primary bedroom to the balcony, with blackout shades.",
        },
        {
          title: "Walk-in closet",
          pageNumber: 3,
          zones: ["primary-closet"],
          content: "Walk-in closet between the primary bedroom and bathroom, with built-in shelving and double hanging rods along one wall.",
        },
        {
          title: "Primary bathroom",
          pageNumber: 3,
          zones: ["primary-bath", "primary-bath-entrance"],
          content: "En-suite bathroom reached through the walk-in closet, with porcelain tile floors.",
        },
        {
          title: "Primary bathroom vanity",
          pageNumber: 3,
          zones: ["primary-vanity"],
          content: "Floating double vanity with two undermount sinks, a quartz top, and a full-width mirror.",
        },
        {
          title: "Primary shower",
          pageNumber: 3,
          zones: ["primary-shower"],
          content: "Walk-in shower with a frameless glass enclosure, rain showerhead, and handheld wand.",
        },
        {
          title: "Primary toilet",
          pageNumber: 3,
          zones: ["primary-toilet"],
          content: "Wall-hung toilet with a concealed tank in its own nook beside the vanity.",
        },
      ],
    },
    {
      id: "h3-floorplan",
      filename: "floor-plan-and-dimensions.pdf",
      title: "Floor plan & dimensions",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Overview",
          pageNumber: 1,
          zones: [],
          content:
            "960 sq ft interior (about 810 sq ft of net room area) plus a 110 sq ft balcony. Ceilings are 9 ft 6 in throughout. The kitchen, dining area, and living room form one open space about 30 ft long from the kitchen to the living room windows.",
        },
        {
          title: "Kitchen",
          pageNumber: 1,
          zones: ["kitchen"],
          content: "Kitchen: 12 ft 6 in x 8 ft 8 in, a galley with a 3 ft 4 in aisle between the two counter runs.",
        },
        {
          title: "Kitchen counters",
          pageNumber: 1,
          zones: ["kitchen-back-counter", "kitchen-main-counter"],
          content:
            "Each counter run is about 12 ft 4 in long. Counters are 36 in high and 25 in deep; upper cabinets start 18 in above the counter and are 13 in deep.",
        },
        {
          title: "Kitchen tall cabinets",
          pageNumber: 1,
          zones: ["kitchen-cabinets"],
          content: "Tall pantry cabinets: 36 in wide, 24 in deep, 8 ft tall.",
        },
        {
          title: "Dining area",
          pageNumber: 1,
          zones: ["dining", "dining-table"],
          content: "Dining area: 10 ft 0 in x 12 ft 2 in. Fits a 42 in round table for four (shown staged) with 3 ft of clearance on every side.",
        },
        {
          title: "Living room",
          pageNumber: 2,
          zones: ["living-room"],
          content: "Living room: 9 ft 8 in x 12 ft 8 in, open to the dining area (about 22 ft 10 in deep together).",
        },
        {
          title: "Living room furniture sizes",
          pageNumber: 2,
          zones: ["couch", "living-tv", "living-shelf"],
          content:
            "The seating wall fits an L-shaped sectional up to 10 ft x 5 ft (shown staged). The TV wall is 7 ft 6 in wide and wired for a TV up to 75 in. The floating media shelf is 90 in long and 16 in deep.",
        },
        {
          title: "Storage closet",
          pageNumber: 2,
          zones: ["storage-closet"],
          content: "Storage closet: 4 ft wide, 22 in deep, 8 ft tall.",
        },
        {
          title: "Balcony",
          pageNumber: 2,
          zones: ["balcony", "living-balcony-door", "primary-balcony-door", "bedroom-2-balcony-door"],
          content:
            "Balcony: about 35 ft long and just over 3 ft deep (110 sq ft), running the whole window side. Balcony doors: 9 ft 6 in tall glass, about 9 ft 8 in wide in the living room, 11 ft 6 in in the primary bedroom, and 12 ft in the second bedroom.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 3,
          zones: ["primary-bedroom", "primary-bed", "primary-nightstand"],
          content:
            "Primary bedroom: 11 ft 6 in x 12 ft 8 in. Fits a king bed (76 x 80 in) with 24 in nightstands on both sides and about 3 ft of walking space at the foot.",
        },
        {
          title: "Primary bedroom dresser wall",
          pageNumber: 3,
          zones: ["primary-dresser", "primary-tv"],
          content: "The wall facing the bed fits a dresser up to 55 in wide and 24 in deep, with a TV up to 55 in above it.",
        },
        {
          title: "Walk-in closet",
          pageNumber: 3,
          zones: ["primary-closet"],
          content: "Walk-in closet: 5 ft 9 in x 9 ft 2 in, with about 9 ft of hanging space in two tiers and 8 ft of shelving.",
        },
        {
          title: "Primary bathroom",
          pageNumber: 3,
          zones: ["primary-bath", "primary-shower", "primary-vanity", "primary-toilet"],
          content: "Primary bathroom: 6 ft 9 in x 12 ft 10 in. Shower 60 x 36 in. Vanity 60 in wide and 21 in deep.",
        },
        {
          title: "Second bedroom",
          pageNumber: 3,
          zones: ["bedroom-2", "bedroom-2-bed", "bedroom-2-nightstand", "bedroom-2-dresser", "bedroom-2-tv"],
          content:
            "Second bedroom: 12 ft 2 in x 8 ft 10 in. Fits a queen bed (60 x 80 in) with an 18 in nightstand, and a dresser up to 60 in wide on the wall facing the bed.",
        },
        {
          title: "Second bedroom closet",
          pageNumber: 3,
          zones: ["bedroom-2-closet"],
          content: "Reach-in closet: 6 ft wide and 2 ft deep, behind sliding doors.",
        },
        {
          title: "Second bathroom",
          pageNumber: 3,
          zones: ["secondary-bath", "secondary-shower", "secondary-vanity", "secondary-toilet"],
          content: "Second bathroom: 8 ft 10 in x 4 ft 7 in. Shower 34 x 48 in. Vanity 24 in wide.",
        },
      ],
    },
    {
      id: "h3-appliances",
      filename: "appliance-and-fixture-schedule.pdf",
      title: "Appliance & fixture schedule",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Back counter stove",
          pageNumber: 1,
          zones: ["kitchen-stove"],
          content:
            "Bosch Benchmark Series 30-inch induction cooktop, four cooking zones, flush-mounted in the back counter. Above it: a Zephyr 30-inch under-cabinet recirculating range hood with LED task lights.",
        },
        {
          title: "Main run stove",
          pageNumber: 1,
          zones: ["kitchen-stove-main"],
          content: "Miele 30-inch induction cooktop, four cooking zones, set into the main counter run.",
        },
        {
          title: "Oven",
          pageNumber: 1,
          zones: ["kitchen-oven-range"],
          content:
            "Bosch 800 Series 30-inch single built-in wall oven with European convection (4.6 cu ft), set at eye level in the tall cabinet column at the end of the main run.",
        },
        {
          title: "Kitchen sink and dishwasher",
          pageNumber: 1,
          zones: ["kitchen-sink"],
          content:
            "Kraus Kore 30-inch single-bowl undermount stainless steel workstation sink with a Kohler Sous pull-down faucet. Beside it: a Bosch 800 Series 24-inch stainless steel dishwasher rated at 42 dBA.",
        },
        {
          title: "Counters and cabinetry",
          pageNumber: 1,
          zones: ["kitchen-back-counter", "kitchen-main-counter", "kitchen-cabinets"],
          content:
            "Caesarstone Pure White quartz counters (3 cm). Flat-panel European-style cabinetry with Blum soft-close hinges and drawer runners. Under-cabinet LED strip lighting on a dimmer. The tall pantry has pull-out shelves.",
        },
        {
          title: "Living room",
          pageNumber: 2,
          zones: ["living-room", "living-tv", "living-shelf"],
          content:
            "32-inch LED ring chandelier (included). 4-inch recessed LED downlights on dimmers. TV wall wired with power, HDMI conduit, and Cat6 behind the screen and the floating white-oak media shelf.",
        },
        {
          title: "Balcony doors and shades",
          pageNumber: 2,
          zones: ["living-balcony-door", "primary-balcony-door", "bedroom-2-balcony-door"],
          content:
            "Impact-rated aluminum sliding glass doors with Miami-Dade product approval. Lutron Sivoia QS motorized shades: light-filtering in the living room, blackout in both bedrooms.",
        },
        {
          title: "Primary bathroom vanity",
          pageNumber: 3,
          zones: ["primary-vanity"],
          content:
            "60-inch floating double vanity with a quartz top, two Kohler Verticyl undermount sinks, Hansgrohe Talis E faucets in brushed nickel, and a full-width LED-backlit mirror.",
        },
        {
          title: "Primary shower",
          pageNumber: 3,
          zones: ["primary-shower"],
          content:
            "Frameless 3/8-inch glass enclosure, Hansgrohe Raindance rain showerhead and handheld on a slide bar, thermostatic valve, and a linear floor drain.",
        },
        {
          title: "Toilets",
          pageNumber: 3,
          zones: ["primary-toilet", "secondary-toilet"],
          content: "TOTO Aquia wall-hung dual-flush toilets on Geberit in-wall tanks, in both bathrooms.",
        },
        {
          title: "Second bathroom fixtures",
          pageNumber: 3,
          zones: ["secondary-vanity", "secondary-shower"],
          content:
            "24-inch floating vanity with a quartz top, a Kohler undermount sink, and a Robern mirrored medicine cabinet. Shower with a frameless glass door and a Grohe Euphoria shower system.",
        },
        {
          title: "Bedrooms",
          pageNumber: 3,
          zones: ["primary-bedroom", "bedroom-2", "primary-closet", "bedroom-2-closet"],
          content:
            "Recessed LED downlights and ceiling-fan-ready junction boxes in both bedrooms. LED strip lighting in the walk-in closet; the reach-in closet has sliding doors with soft-close tracks.",
        },
        {
          title: "Whole-home systems",
          pageNumber: 4,
          zones: [],
          content:
            "Carrier ducted heat pump with central air and an ecobee smart thermostat. 9-inch-wide engineered white oak plank floors in the living areas and bedrooms; 24 x 48 in porcelain tile in the bathrooms.",
        },
      ],
    },
    {
      id: "h3-hoa",
      filename: "hoa-summary.pdf",
      title: "HOA documents",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Fees and amenities",
          pageNumber: 1,
          zones: [],
          content:
            "Monthly dues are $780 and cover water, building insurance, 24-hour front desk, the rooftop pool, the fitness center, and common-area maintenance.",
        },
        {
          title: "Rules",
          pageNumber: 3,
          zones: [],
          content: "Up to two pets per unit. Minimum lease term is 6 months. Balcony grills and enclosures are not permitted.",
        },
      ],
    },
    {
      id: "h3-disclosure",
      filename: "seller-disclosure-summary.pdf",
      title: "Seller disclosure",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Systems and warranty",
          pageNumber: 1,
          zones: [],
          content:
            "New construction, completed 2025. Unit is covered by the developer's one-year warranty on finishes and appliances. Central air and heat pump are original to the 2025 build. No known defects.",
        },
      ],
    },
    {
      id: "h3-neighborhood",
      filename: "neighborhood-notes.md",
      title: "Neighborhood guide",
      sourceKind: "manual_note",
      sections: [
        {
          title: "Nearby",
          zones: [],
          content:
            "A public park is approximately 0.2 miles away. The nearest Metromover station is about 0.5 miles away. A grocery store is approximately 0.4 miles away, and the nearest beach access is about 3 miles away.",
        },
      ],
    },
  ],
};

export const houses: House[] = [house3];

export function getHouse(slug: string): House | undefined {
  return houses.find((h) => h.slug === slug);
}

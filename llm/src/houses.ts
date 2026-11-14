import type { House } from "./types";

// Fake realtor-supplied context for the demo. Listing details are fictional.

// 3D tour: the "Seven Park â€“ Miami â€“ Unit" splat, streamed from superspl.at
// (see engine/scripts/fetch-sample.sh). The scan is copyrighted, so it's
// streamed, never copied into the repo. Listing details are fictional; the
// living room text matches the scene's preview, other rooms are kept generic.
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
    { id: "living-room", name: "Living room", kind: "room", parentId: "property", aliases: ["living area", "lounge"] },
    { id: "balcony", name: "Balcony", kind: "outdoor_area", parentId: "property", aliases: ["terrace", "outside"] },
    { id: "kitchen", name: "Kitchen", kind: "room", parentId: "property" },
    { id: "primary-bedroom", name: "Primary bedroom", kind: "room", parentId: "property", aliases: ["bedroom", "master bedroom"] },
    { id: "primary-bath", name: "Primary bathroom", kind: "room", parentId: "property", aliases: ["en-suite", "bathroom"] },
  ],
  scene: {
    contentUrl: "https://d28zzqy0iyovbz.cloudfront.net/b185fd52/v1/meta.json",
    settingsUrl: "/scenes/seven-park/settings.json",
    collisionUrl: "https://d28zzqy0iyovbz.cloudfront.net/b185fd52/v1/scene.voxel.json",
    aa: false,
    credit: "3D scan: â€œSeven Park â€“ Miami â€“ Unitâ€ by sa3d, Â© stepinc.co, streamed from superspl.at",
  },
  views: [],
  facts: [
    { key: "listing_price", label: "List price", displayValue: "$865,000", source: "Listing basics form" },
    { key: "property_type", label: "Property type", displayValue: "Condominium, 12th floor", source: "Listing basics form" },
    { key: "bedrooms", label: "Bedrooms", displayValue: "2", source: "Listing basics form" },
    { key: "bathrooms", label: "Bathrooms", displayValue: "2", source: "Listing basics form" },
    { key: "interior_sqft", label: "Interior", displayValue: "1,080 sq ft", source: "Condo declaration" },
    { key: "balcony_sqft", label: "Balcony", displayValue: "110 sq ft", source: "Condo declaration" },
    { key: "year_built", label: "Year built", displayValue: "2025 (new construction)", source: "County assessor record" },
    { key: "flooring", label: "Flooring", displayValue: "Wide-plank light oak engineered wood in living areas and bedrooms", source: "Realtor amenities form" },
    { key: "ceiling_height", label: "Ceilings", displayValue: "9 ft 6 in", source: "Realtor amenities form" },
    { key: "windows", label: "Windows", displayValue: "Floor-to-ceiling impact-resistant glass", source: "Realtor amenities form" },
    { key: "countertop_material", label: "Countertops", displayValue: "White quartz", source: "Realtor amenities form" },
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
          title: "Living room",
          pageNumber: 1,
          zones: ["living-room"],
          content:
            "Open living room with floor-to-ceiling windows leading to the balcony, recessed ceiling lights, and a statement ring chandelier. Wide-plank light oak floors. Wall pre-wired for a mounted TV. The primary bedroom opens off the living room.",
        },
        {
          title: "Balcony",
          pageNumber: 1,
          zones: ["balcony"],
          content: "Private balcony off the living room with a glass-and-metal railing and open city views from the 12th floor.",
        },
        {
          title: "Kitchen",
          pageNumber: 2,
          zones: ["kitchen"],
          content: "Kitchen with flat-panel European-style cabinetry, white quartz countertops, and stainless steel appliances.",
        },
        {
          title: "Primary bedroom",
          pageNumber: 2,
          zones: ["primary-bedroom"],
          content: "Primary bedroom off the living room with floor-to-ceiling windows, light oak floors, a built-in closet, and an en-suite bathroom.",
        },
        {
          title: "Primary bathroom",
          pageNumber: 2,
          zones: ["primary-bath"],
          content: "En-suite bathroom with a walk-in glass shower and a floating vanity.",
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

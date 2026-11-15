import type { House } from "./types";

// Room 003-114: a classroom in the Business Building (Building 003) at Cal Poly, San Luis Obispo,
// home of the Orfalea College of Business (OCOB).
// - Building and college background is from public sources (Cal Poly facilities records, the
//   college's 2022 "building the future" news post, Wikipedia): Building 003, about 76,000 sq ft,
//   four stories, completed in the early 1990s on the Richard O'Neill Green; the college began as a
//   business department in 1959 and was named for Kinko's founder Paul Orfalea after his
//   $15 million gift in 2001; six college classrooms were recently upgraded; the first floor hosts
//   the Low Income Tax Clinic and VITA.
// - Everything about room 114 itself beyond the 60 seats (technology, makes, sizes, booking,
//   courses) is fictional, written to match the scan.
//
// 3D tour: our own LiDAR scan of the room (Polycam point cloud, 2.6M points), converted to
// Gaussian splats (scripts/points-to-splats.cjs) and compressed with PlayCanvas splat-transform;
// walk collision built from the same splats (apps/web/tours/business-room.json, files in
// apps/web/public/scans/business-room/).
//
// World coordinates: y up, floor at y = 0, ceiling about 3.3 m. The room is about 15 m (x) by
// 12.8 m (z): an open floor in the middle (around x -3..3, z -1.5..3.5) ringed by U-shaped rows
// of desks, windows along the far (-z) wall. The camera starts at the back of the room (z 4)
// looking across the desks toward the windows.
//
// Zones: one room zone for the whole space, so questions know they're asked in the room. Objects
// (desks, screens, the lectern) can be placed from a walkthrough log on the settings page
// (/business-room/admin), as for the houses.

export const businessRoom: House = {
  id: "business-room",
  slug: "business-room",
  title: "Business Room",
  address: "Business Building (003), Room 114, Cal Poly",
  city: "San Luis Obispo",
  region: "CA",
  summary:
    "Room 003-114: a 60-seat classroom on the ground floor of Cal Poly's Business Building, home of the Orfalea College of Business, with rows of tables wrapped around an open teaching floor.",
  zones: [
    { id: "property", name: "Business Building", kind: "property" },
    {
      id: "business-room",
      name: "Room 003-114",
      kind: "room",
      parentId: "property",
      aliases: ["business room", "room 114", "classroom", "lecture room", "this room"],
      boxes: [{ min: [-7.6, -1, -6.4], max: [7.4, 3.3, 6.4] }],
    },
  ],
  // The walk-through: apps/web/tours/business-room.json.
  scene: { tour: "business-room" },
  facts: [
    { key: "room", label: "Room", displayValue: "003-114: Business Building (Building 003), room 114, ground floor", source: "Room data sheet" },
    { key: "type", label: "Room type", displayValue: "General-assignment classroom, scheduled by the Orfalea College of Business", source: "Room data sheet" },
    { key: "capacity", label: "Seating", displayValue: "60 seats at fixed tables, in U-shaped rows facing the teaching floor", source: "Room data sheet" },
    { key: "size", label: "Size", displayValue: "About 2,050 sq ft (49 ft by 42 ft)", source: "Measurements & inventory" },
    { key: "ceiling_height", label: "Ceiling", displayValue: "10 ft 10 in, acoustic tile with recessed lighting", source: "Measurements & inventory" },
    { key: "technology", label: "Technology", displayValue: "Laser projector and 120-inch screen, two side displays, a document camera, lecture capture, and power at every seat", source: "Classroom technology guide" },
    { key: "accessibility", label: "Accessibility", displayValue: "Level entry from the ground-floor corridor; four wheelchair spaces at the front tables", source: "Room data sheet" },
    { key: "building", label: "Building", displayValue: "Business Building, four stories, about 76,000 sq ft, completed in 1993", source: "Campus facilities record" },
    { key: "college", label: "College", displayValue: "Orfalea College of Business, named in 2001 for Kinko's founder Paul Orfalea", source: "Orfalea College of Business overview" },
  ],
  documents: [
    {
      id: "br-room",
      filename: "room-003-114-data-sheet.pdf",
      title: "Room data sheet",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "The room",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Room 114 is a ground-floor classroom in the Business Building. It seats 60 at long fixed tables arranged in U-shaped rows around an open teaching floor, so every seat faces the front. Windows run along the far wall, and a wall clock and exit signs sit above the doors.",
        },
        {
          title: "Teaching floor",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "The open floor in the middle holds the instructor's lectern and a movable worktable for demos and group work. Instructors can walk right up to every row, which suits case discussions and workshops.",
        },
        {
          title: "Typical use",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Scheduled mostly for Orfalea College of Business lecture and discussion sections (accounting, economics, finance, and management courses), plus club meetings, recruiting info sessions, and workshops in the evenings.",
        },
        {
          title: "Booking",
          pageNumber: 2,
          zones: [],
          content:
            "Class sections are assigned through the university's classroom scheduling. Student organizations and campus departments can request the room for events outside class hours through the college's facilities coordinator, usually at least five business days ahead.",
        },
        {
          title: "Accessibility",
          pageNumber: 2,
          zones: ["business-room"],
          content:
            "Level entry from the ground-floor corridor with a 36 in door and an automatic opener. Four wheelchair spaces at the front tables, an assistive listening system, and captioning on lecture capture.",
        },
        {
          title: "Rules",
          pageNumber: 2,
          zones: [],
          content: "No food at the tables during class (covered drinks are fine). Return the movable worktable and lectern to the teaching floor after use. The room locks automatically at 10 pm.",
        },
      ],
    },
    {
      id: "br-tech",
      filename: "classroom-technology-guide.pdf",
      title: "Classroom technology guide",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Projection",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Ceiling-mounted Epson laser projector (7,000 lumens) on a 120-inch motorized screen at the front, plus two 75-inch Samsung displays on the side walls that mirror it for the back rows.",
        },
        {
          title: "Lectern",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Instructor lectern with a Windows PC, HDMI and USB-C inputs for laptops, a Crestron touch panel for the lights, screen, and audio, and an Elmo document camera.",
        },
        {
          title: "Audio and lecture capture",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Shure ceiling microphone array and in-ceiling speakers, a wireless lavalier mic, and a PTZ camera at the back wall for lecture capture and Zoom sessions.",
        },
        {
          title: "Power and network",
          pageNumber: 2,
          zones: ["business-room"],
          content: "Power and USB-C charging at every seat, built into the tables. Campus Wi-Fi throughout, with wired ethernet at the lectern.",
        },
        {
          title: "Lighting and climate",
          pageNumber: 2,
          zones: ["business-room"],
          content:
            "Recessed LED panels in the acoustic tile ceiling, zoned so the front can be dimmed for projection, plus wall sconces along the side walls. Light-filtering roller shades on the windows. The room is on its own heating and cooling zone.",
        },
      ],
    },
    {
      id: "br-measurements",
      filename: "measurements-and-inventory.pdf",
      title: "Measurements & inventory",
      sourceKind: "realtor_upload",
      sections: [
        {
          title: "Room size",
          pageNumber: 1,
          zones: ["business-room"],
          content: "About 49 ft by 42 ft (2,050 sq ft) with a 10 ft 10 in ceiling. The open teaching floor in the middle is about 20 ft by 16 ft.",
        },
        {
          title: "Tables and chairs",
          pageNumber: 1,
          zones: ["business-room"],
          content:
            "Long fixed tables in laminate with a dark edge, 18 in deep and 29 in high, seating 60 in U-shaped rows; the aisles between rows are about 3 ft wide. Steelcase Series 1 chairs in graphite on casters.",
        },
        {
          title: "Teaching floor furniture",
          pageNumber: 1,
          zones: ["business-room"],
          content: "Lectern: 42 in wide and 24 in deep. Movable worktable: 72 by 30 in, on locking casters.",
        },
        {
          title: "Windows and boards",
          pageNumber: 1,
          zones: ["business-room"],
          content: "Three windows on the far wall, each about 4 ft wide and 7 ft tall. Two 8 ft whiteboards on the front wall, one each side of the screen.",
        },
      ],
    },
    {
      id: "br-building",
      filename: "business-building-facts.pdf",
      title: "Campus facilities record",
      sourceKind: "public_record",
      sections: [
        {
          title: "Business Building",
          pageNumber: 1,
          zones: [],
          content:
            "The Business Building is Building 003 on the Cal Poly campus in San Luis Obispo: four stories and about 76,000 sq ft, completed in 1993, facing the Richard O'Neill Green. It holds the Orfalea College of Business's classrooms, labs, and offices; the dean's office is on the fourth floor (room 455).",
        },
        {
          title: "Ground floor",
          pageNumber: 1,
          zones: [],
          content:
            "Room 114 is on the ground floor, which also hosts the college's Low Income Tax Clinic and VITA (Volunteer Income Tax Assistance) programs, where students prepare tax returns for community members. Restrooms and a drinking fountain with a bottle filler are just down the corridor.",
        },
        {
          title: "Recent updates",
          pageNumber: 2,
          zones: [],
          content:
            "The college recently upgraded six of the classrooms it controls with new furniture and teaching technology, refreshed the Industrial Technology & Packaging teaching lab, and has planned a Student Success Center on the third floor and new outdoor study spaces around the building.",
        },
      ],
    },
    {
      id: "br-college",
      filename: "orfalea-college-overview.md",
      title: "Orfalea College of Business overview",
      sourceKind: "generated_summary",
      sections: [
        {
          title: "The college",
          zones: [],
          content:
            "Business has been taught at Cal Poly since the 1920s; the college began as a business department in 1959 and was named the Orfalea College of Business in 2001, after Kinko's founder Paul Orfalea gave $15 million. It offers majors in Business Administration, Economics, and Industrial Technology and Packaging, plus master's programs including the MBA, Accounting, Business Analytics, and Taxation, all with Cal Poly's Learn by Doing approach.",
        },
        {
          title: "Around the building",
          zones: [],
          content:
            "The Business Building sits in the center of campus, a short walk from the Robert E. Kennedy Library, the University Union, and Dexter Lawn.",
        },
      ],
    },
  ],
};

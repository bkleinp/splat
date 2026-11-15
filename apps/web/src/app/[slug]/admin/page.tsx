import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHouse, sourceLabels } from "@splat/llm";
import { loadTour, toursEditable } from "@/lib/tours";
import { AdminExperience } from "./AdminExperience";

// The home's tour settings (/<slug>/admin): the walk-through with a panel that previews walk,
// look and floor plan changes live and saves them to apps/web/tours/<tour>.json. Dev server only:
// it writes files, so a production build 404s it. Also the home's debug tools: the chat with the
// Position / Facing readout (the location context each question got) and the walkthrough logger
// for placing zones.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tour settings", robots: { index: false } };

export default async function HouseAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!toursEditable()) notFound();
  const { slug } = await params;
  const house = getHouse(slug);
  const name = house?.scene?.tour;
  const tour = name ? await loadTour(name) : null;
  if (!house || !name || !tour) notFound();

  // Logger: one floor button per floor zone (camera height where each starts).
  const floorStarts = house.zones
    .filter((z) => z.kind === "floor" && z.boxes?.length)
    .map((z) => z.boxes![0].min[1])
    .sort((a, b) => a - b);

  return (
    <AdminExperience
      key={name}
      name={name}
      tour={tour}
      openHref={`/${house.slug}`}
      house={{ slug: house.slug, title: house.title, sources: sourceLabels(house), floorStarts }}
    />
  );
}

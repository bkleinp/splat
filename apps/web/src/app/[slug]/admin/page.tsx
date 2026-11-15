import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHouse } from "@splat/llm";
import { loadTour, toursEditable } from "@/lib/tours";
import { AdminExperience } from "./AdminExperience";

// The home's tour settings (/<slug>/admin): the walk-through with a panel that previews walk,
// look and floor plan changes live and saves them to apps/web/tours/<tour>.json. Dev server only:
// it writes files, so a production build 404s it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tour settings", robots: { index: false } };

export default async function HouseAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!toursEditable()) notFound();
  const { slug } = await params;
  const house = getHouse(slug);
  const name = house?.scene?.tour;
  const tour = name ? await loadTour(name) : null;
  if (!house || !name || !tour) notFound();

  return <AdminExperience key={name} name={name} tour={tour} openHref={`/${house.slug}`} />;
}

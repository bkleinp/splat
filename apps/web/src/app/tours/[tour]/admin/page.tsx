import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { houses } from "@splat/llm";
import { loadTour, toursEditable } from "@/lib/tours";
import { AdminExperience } from "./AdminExperience";

// The tour's settings page: the walk-through with a panel that previews walk, look and floor plan
// changes live and saves them to apps/web/tours/<tour>.json. Dev server only: it writes files.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tour settings", robots: { index: false } };

export default async function TourAdminPage({ params }: { params: Promise<{ tour: string }> }) {
  if (!toursEditable()) notFound();
  const { tour: name } = await params;
  const tour = await loadTour(name);
  if (!tour) notFound();

  // "Open tour" goes to the customer page of the home that shows this tour, if there is one.
  const house = houses.find((h) => h.scene?.tour === name);

  return <AdminExperience key={name} name={name} tour={tour} openHref={house ? `/house/${house.slug}` : null} />;
}

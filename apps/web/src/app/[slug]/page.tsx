import { notFound } from "next/navigation";
import { getHouse, houses, sourceLabels } from "@splat/llm";
import { loadTour } from "@/lib/tours";
import { HouseExperience } from "./HouseExperience";

export function generateStaticParams() {
  return houses.filter((h) => h.scene).map((h) => ({ slug: h.slug }));
}

// The house context (facts, documents, zones) stays server-side: it's only sent
// to the model, never rendered or passed to the client. Visitors get the 3D
// walk-through (the tour file from apps/web/tours) and the chat.
export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const house = getHouse(slug);
  const tour = house?.scene ? await loadTour(house.scene.tour) : null;
  if (!house || !tour) notFound();

  return (
    <HouseExperience
      key={house.slug}
      houseSlug={house.slug}
      houseTitle={house.title}
      tourName={house.scene!.tour}
      tour={tour}
      sources={sourceLabels(house)}
    />
  );
}

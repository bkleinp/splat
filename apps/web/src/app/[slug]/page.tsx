import { notFound } from "next/navigation";
import { getHouse, houses, sourceLabels } from "@splat/llm";
import { loadTour } from "@/lib/tours";
import { HouseExperience, type LoggerSetup } from "./HouseExperience";

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

  // Dev server only: the walkthrough logger for placing zones (see components/tour/WalkLogger).
  // It opens by itself while some rooms have no boxes yet; ?log opens it on any home.
  let logger: LoggerSetup | null = null;
  if (process.env.NODE_ENV !== "production") {
    const floorStarts = house.zones
      .filter((z) => z.kind === "floor" && z.boxes?.length)
      .map((z) => z.boxes![0].min[1])
      .sort((a, b) => a - b);
    logger = {
      floorStarts,
      unmapped: house.zones.some((z) => z.kind === "room" && !z.boxes?.length),
    };
  }

  return (
    <HouseExperience
      key={house.slug}
      houseSlug={house.slug}
      houseTitle={house.title}
      tourName={house.scene!.tour}
      tour={tour}
      sources={sourceLabels(house)}
      logger={logger}
    />
  );
}

import { notFound } from "next/navigation";
import { getHouse, houses, sourceLabels } from "@splat/llm";
import { HouseExperience } from "./HouseExperience";

export function generateStaticParams() {
  return houses.filter((h) => h.scene).map((h) => ({ slug: h.slug }));
}

// The house context (facts, documents, zones) stays server-side: it's only sent
// to the model, never rendered or passed to the client. Visitors get the 3D
// tour and the chat.
export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const house = getHouse(slug);
  if (!house?.scene) notFound();

  return (
    <HouseExperience
      key={house.slug}
      houseSlug={house.slug}
      houseTitle={house.title}
      scene={house.scene}
      sources={sourceLabels(house)}
    />
  );
}

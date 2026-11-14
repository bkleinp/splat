import Link from "next/link";
import { notFound } from "next/navigation";
import { getHouse, houses, sourceLabels } from "@splat/llm";
import { HouseExperience } from "./HouseExperience";

export function generateStaticParams() {
  return houses.map((h) => ({ slug: h.slug }));
}

// The house context (facts, documents, zones) stays server-side: it's only sent
// to the model, never rendered or passed to the client. Visitors get the photos
// (the 3D viewer's future spot) and the chat.
export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const house = getHouse(slug);
  if (!house) notFound();

  const views = house.views.map(({ id, label, src, alt, credit }) => ({ id, label, src, alt, credit }));

  return (
    <>
      <Link href="/" className="back">
        ← All homes
      </Link>
      <h1 className="house-title">{house.title}</h1>
      <HouseExperience
        key={house.slug}
        houseSlug={house.slug}
        houseTitle={house.title}
        views={views}
        sources={sourceLabels(house)}
      />
    </>
  );
}

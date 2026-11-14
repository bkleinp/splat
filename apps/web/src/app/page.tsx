import Link from "next/link";
import { houses } from "@splat/llm";

export default function HomePage() {
  return (
    <>
      <h1>Choose a home</h1>
      <p className="muted">Pick a listing to see the realtor-supplied context the assistant will use.</p>
      <div className="house-grid">
        {houses.map((house, i) => (
          <Link key={house.id} href={`/house/${house.slug}`} className="house-card">
            <span className="eyebrow">House {i + 1}</span>
            <h2>{house.title}</h2>
            <p className="muted">
              {house.address}, {house.city}, {house.region}
            </p>
            <p>{house.summary}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { houses } from "@splat/llm";

export default function HomePage() {
  return (
    <>
      <h1>Choose a home</h1>
      <p className="muted">Walk through each home in 3D and ask our assistant anything along the way.</p>
      <div className="house-grid">
        {houses.map((house) => (
          <Link key={house.id} href={`/house/${house.slug}`} className="house-card">
            {house.scene && <span className="eyebrow">3D tour</span>}
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

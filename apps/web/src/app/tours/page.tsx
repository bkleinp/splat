import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { houses } from "@splat/llm";
import { listTours, toursEditable } from "@/lib/tours";

// Dev-only list of the tour files (apps/web/tours), each with its settings page. Customers find
// tours through the homes on the home page instead.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tours", robots: { index: false } };

export default async function ToursPage() {
  if (!toursEditable()) notFound();
  const tours = await listTours();

  return (
    <main className="container">
      <p className="eyebrow">Dev tools</p>
      <h1>Tours</h1>
      <p className="muted">
        Each tour is a file in <code>apps/web/tours</code>. Its settings page previews walk, look and floor plan
        changes live and saves them to that file.
      </p>
      <ul className="tour-list">
        {tours.map((t) => {
          const house = houses.find((h) => h.scene?.tour === t.name);
          return (
            <li key={t.name}>
              <span className="tour-list-title">
                {t.title}
                <span className="muted">
                  {" "}
                  · {t.name}.json{house ? ` · ${house.title}` : " · not used by a home"}
                </span>
              </span>
              <span className="tour-list-links">
                {house && <Link href={`/house/${house.slug}`}>Open</Link>}
                <Link href={`/tours/${t.name}/admin`}>Settings</Link>
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

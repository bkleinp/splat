import { NextResponse } from "next/server";
import { loadTour, saveTour, toursEditable } from "@/lib/tours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

const notFound = (name: string) => NextResponse.json({ error: `no tour named "${name}"` }, { status: 404 });

export async function GET(_req: Request, { params }: Params) {
  if (!toursEditable()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { name } = await params;
  const tour = await loadTour(name);
  return tour ? NextResponse.json(tour) : notFound(name);
}

export async function PUT(req: Request, { params }: Params) {
  if (!toursEditable()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { name } = await params;
  const text = await req.text();
  if (text.length > 1_000_000) return NextResponse.json({ error: "body too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }
  const result = await saveTour(name, body);
  if (result === "not-found") return notFound(name);
  if (result === "invalid") return NextResponse.json({ error: 'a tour needs at least a "content" url' }, { status: 400 });
  return NextResponse.json({ saved: name });
}

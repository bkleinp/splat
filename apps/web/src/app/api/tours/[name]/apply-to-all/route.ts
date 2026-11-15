import { NextResponse } from "next/server";
import { applyToAllTours, toursEditable } from "@/lib/tours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!toursEditable()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { name } = await params;
  const updated = await applyToAllTours(name);
  return updated ? NextResponse.json({ updated }) : NextResponse.json({ error: `no tour named "${name}"` }, { status: 404 });
}

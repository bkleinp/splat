import { NextResponse } from "next/server";
import { listTours, toursEditable } from "@/lib/tours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only tour API for the settings pages (ported from the tours app's dev API):
//   GET  /api/tours                      -> [{ name, title }]
//   GET  /api/tours/:name                -> the tour file
//   PUT  /api/tours/:name                -> replace the tour file
//   POST /api/tours/:name/apply-to-all   -> copy this tour's walk + look settings to every tour

export async function GET() {
  if (!toursEditable()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(await listTours());
}

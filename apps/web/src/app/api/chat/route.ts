import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getHouse } from "@splat/llm";
import { streamChatAboutHouse, type ChatTurn } from "@splat/llm/claude";
import { parsePose } from "@/lib/pose";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 2000;

function parseMessages(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const turns: ChatTurn[] = [];
  for (const m of value) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content, pose } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    if (content.trim() === "" || content.length > MAX_MESSAGE_CHARS) return null;
    // A missing pose, or one outside every zone, isn't an error: it resolves to "location unknown".
    const parsedPose = parsePose(pose);
    if (parsedPose === null) return null;
    turns.push({ role, content, pose: parsedPose });
  }
  if (turns[turns.length - 1].role !== "user") return null;
  return turns;
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Anthropic auth failed — check ANTHROPIC_API_KEY in apps/web/.env.local");
    return "The assistant isn't configured correctly.";
  }
  if (err instanceof Anthropic.RateLimitError) return "The assistant is busy. Try again in a moment.";
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return "The assistant is unavailable right now.";
  }
  console.error(err);
  return "Something went wrong.";
}

/**
 * Streams newline-delimited JSON: one `{type:"location", location}` (where the
 * visitor was resolved to), then `{type:"text"|"replace", text}` events from
 * the model, then exactly one `{type:"done"}` or `{type:"error", error}`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { houseSlug, messages } = (body ?? {}) as Record<string, unknown>;
  const house = typeof houseSlug === "string" ? getHouse(houseSlug) : undefined;
  if (!house) return NextResponse.json({ error: "Unknown house." }, { status: 404 });

  const turns = parseMessages(messages);
  if (!turns) {
    return NextResponse.json({ error: "messages must be a non-empty list of turns ending with a user message." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        // req.signal aborts the upstream Claude request if the visitor navigates away.
        for await (const event of streamChatAboutHouse(house, turns, req.signal)) send(event);
        send({ type: "done" });
      } catch (err) {
        if (!req.signal.aborted) send({ type: "error", error: describeError(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the client disconnected.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

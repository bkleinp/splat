import Anthropic from "@anthropic-ai/sdk";
import { buildHouseContext, formatLocation, SYSTEM_PROMPT } from "./context";
import { resolvePose, type Pose, type ResolvedLocation } from "./spatial";
import type { House } from "./types";

// Server-only: reads ANTHROPIC_API_KEY from the environment. Never import from client components.

/** Small, fast model for listing Q&A. */
export const CHAT_MODEL = "claude-haiku-5-5";

/** Only the most recent turns are sent; the evidence is re-sent fresh every request. */
const MAX_HISTORY_MESSAGES = 12;

const REFUSAL_REPLY = "I can't help with that question. You can ask the listing agent directly.";
const EMPTY_REPLY = "I don't have a verified answer for that. You can ask the listing agent.";

/** `pose` on user turns: where the visitor's camera was when they asked. */
export type ChatTurn = { role: "user" | "assistant"; content: string; pose?: Pose };

/**
 * `location` comes first: where the server resolved the visitor to.
 * `text` appends to the answer being shown; `replace` swaps the whole answer
 * (used when the model refuses partway through or returns nothing).
 */
export type ChatStreamEvent =
  | { type: "location"; location: ResolvedLocation }
  | { type: "text"; text: string }
  | { type: "replace"; text: string };

let client: Anthropic | undefined;

function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export async function* streamChatAboutHouse(
  house: House,
  history: ChatTurn[],
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  let recent = history.slice(-MAX_HISTORY_MESSAGES);
  // The API requires the conversation to start with a user turn.
  while (recent.length > 0 && recent[0].role !== "user") recent = recent.slice(1);

  // Resolve the latest location every message (blueprint § "Follow-up questions").
  const latest = recent[recent.length - 1];
  const location = resolvePose(house, latest.pose);
  yield { type: "location", location };

  // Evidence rides in the system prompt so it isn't repeated in history; it's
  // re-ranked for the current location on every request.
  const system = `${SYSTEM_PROMPT}\n\n<evidence>\n${buildHouseContext(house, location)}\n</evidence>`;

  const messages = recent.map((t, i): Anthropic.MessageParam => {
    if (t.role === "assistant") return { role: "assistant", content: t.content };
    const isLatest = i === recent.length - 1;
    const where = isLatest ? formatLocation(location) : formatLocation(resolvePose(house, t.pose), { brief: true });
    return { role: "user", content: `${where}\n\n${t.content}` };
  });

  const stream = getClient().messages.stream(
    {
      model: CHAT_MODEL,
      max_tokens: 2048,
      output_config: { effort: "low" },
      system,
      messages,
    },
    { signal },
  );

  let sawText = false;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      sawText = true;
      yield { type: "text", text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield { type: "replace", text: REFUSAL_REPLY };
  } else if (!sawText) {
    yield { type: "replace", text: EMPTY_REPLY };
  }
}

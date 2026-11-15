import type { Pose, Vec3 } from "@splat/llm";

// Poses come from the browser, so they're untrusted: finite numbers only, and
// within a generous bound of any scene so garbage can't reach the resolver.
const MAX_COORD = 1000;

function parseVec3(value: unknown): Vec3 | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= MAX_COORD)) return null;
  return [value[0], value[1], value[2]];
}

/** `undefined` = no pose sent (fine), `null` = malformed (reject the request). */
export function parsePose(value: unknown): Pose | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return null;
  const { position, forward } = value as Record<string, unknown>;
  const p = parseVec3(position);
  if (!p) return null;
  if (forward === undefined) return { position: p };
  const f = parseVec3(forward);
  return f ? { position: p, forward: f } : null;
}

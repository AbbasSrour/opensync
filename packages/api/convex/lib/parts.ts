// Canonical message part helpers for the Convex backend.
//
// Mirrors the canonical part contract defined in @opensync/kit. Kept local to
// the Convex package so the deployed functions do not depend on the kit build.
// Clients send only `parts`; the backend derives all flat text from them.

import { v } from "convex/values";

// Validator for an incoming/stored message part.
export const partValidator = v.object({
  type: v.string(),
  content: v.any(),
});

export type StoredPart = { type: string; content: unknown };

// Extract flat text from the text-bearing parts (text + reasoning).
// Tolerates string content and legacy object shapes ({ text } / { content }).
export function joinTextParts(parts: ReadonlyArray<StoredPart>): string {
  return parts
    .filter((part) => part.type === "text" || part.type === "reasoning")
    .map((part) => partText(part.content))
    .filter((text) => text.length > 0)
    .join("");
}

function partText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
  }
  return "";
}

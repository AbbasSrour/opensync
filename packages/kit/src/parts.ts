// Canonical, source-agnostic message part format.
//
// Every source adapter normalizes its native part representation into this
// shape so the backend, API, and frontend can treat all clients uniformly.
// Unknown native types are preserved losslessly via `type: "unknown"`.

export type MessagePartType =
  | "text"
  | "reasoning"
  | "tool-call"
  | "tool-result"
  | "file"
  | "step-start"
  | "step-finish"
  | "unknown";

export type TextPartContent = { text: string };
export type ReasoningPartContent = { text: string };
export type ToolCallPartContent = { callId: string; name: string; args: unknown };
export type ToolResultPartContent = {
  callId: string;
  name: string;
  result: unknown;
  isError?: boolean;
};
export type FilePartContent = { mime?: string; filename?: string; url?: string };
export type StepPartContent = Record<string, never>;
export type UnknownPartContent = unknown;

export type MessagePart =
  | { type: "text"; content: TextPartContent }
  | { type: "reasoning"; content: ReasoningPartContent }
  | { type: "tool-call"; content: ToolCallPartContent }
  | { type: "tool-result"; content: ToolResultPartContent }
  | { type: "file"; content: FilePartContent }
  | { type: "step-start"; content: StepPartContent }
  | { type: "step-finish"; content: StepPartContent }
  | { type: "unknown"; content: UnknownPartContent };

// Join the text-bearing parts (text + reasoning) into a single string.
// Used to derive flat text for search, embeddings, and role inference.
export function joinTextParts(parts: MessagePart[]): string {
  return parts
    .filter((part) => part.type === "text" || part.type === "reasoning")
    .map((part) => (part.content as TextPartContent).text ?? "")
    .filter((text) => text.length > 0)
    .join("");
}

import { createOpenAI } from "@ai-sdk/openai";

// All AI provider config is env-driven. Embeddings and the RAG LLM can point at
// any OpenAI-compatible endpoint (Cloudflare Workers AI, Pioneer, OpenAI, etc.).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set`);
  return value;
}

// ---- Embeddings ----

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";

// Must match the `dimensions` set on the vector indexes in schema.ts.
export const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION ?? "1024");

/** Generate an embedding via an OpenAI-compatible /embeddings endpoint. */
export async function embed(text: string): Promise<number[]> {
  const baseUrl = required("EMBEDDING_BASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("EMBEDDING_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for many texts in a single batched /embeddings request.
 * Returns one vector per input, in the same order as `texts`.
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const baseUrl = required("EMBEDDING_BASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("EMBEDDING_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((text) => text.slice(0, 8000)),
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${await response.text()}`);
  }

  const data = await response.json();
  // Order by `index` to be safe; OpenAI-compatible APIs return it per item.
  const items = [...data.data].sort((a, b) => a.index - b.index);
  return items.map((item: { embedding: number[] }) => item.embedding);
}

// AI SDK model factories below run at module init (RAG is constructed at import
// time), so they must not throw when env is unset — they read env directly and
// only fail on actual use, matching AI SDK behavior.

/** AI SDK embedding model for the @convex-dev/rag component. */
export function embeddingModel() {
  const provider = createOpenAI({
    baseURL: (process.env.EMBEDDING_BASE_URL ?? "").replace(/\/$/, ""),
    apiKey: process.env.EMBEDDING_API_KEY,
  });
  return provider.embedding(EMBEDDING_MODEL);
}

// ---- LLM (RAG answer generation) ----

export const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-ai/DeepSeek-V4-Flash";

/** AI SDK language model for RAG answer generation. */
export function llmModel() {
  const provider = createOpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  });
  return provider(LLM_MODEL);
}

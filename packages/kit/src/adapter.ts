import type { MessageRole } from "./events.js";

export type AdapterSession<TSource extends string = string> = {
  source: TSource;
  externalId: string;
  title?: string;
  projectPath?: string;
  projectName?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  sourceCreatedAt?: number;
  sourceUpdatedAt?: number;
};

export type AdapterMessage<TSource extends string = string> = {
  source: TSource;
  sessionExternalId: string;
  externalId: string;
  role: MessageRole;
  textContent?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  cost?: number;
  sourceCreatedAt?: number;
  sourceUpdatedAt?: number;
};

export type AdapterReadOptions = {
  params?: Record<string, string>;
};

export abstract class SourceAdapter<TSource extends string = string> {
  constructor(readonly source: TSource) {}

  abstract listSessions(options?: AdapterReadOptions): AdapterSession<TSource>[];

  abstract getSession(
    externalId: string,
    options?: AdapterReadOptions,
  ): AdapterSession<TSource> | null;

  abstract listMessages(
    sessionExternalId?: string,
    options?: AdapterReadOptions,
  ): AdapterMessage<TSource>[];

  abstract getMessage(
    externalId: string,
    options?: AdapterReadOptions,
  ): AdapterMessage<TSource> | null;
}

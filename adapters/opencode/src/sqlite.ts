import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  SourceAdapter,
  type AdapterMessage,
  type AdapterReadOptions,
  type AdapterSession,
} from "@opensync/kit";
import { Database } from "bun:sqlite";
import { messageRowSyncStatus, messageRowToRecord, sessionRowToRecord } from "./records.js";
import type { OpenCodeMessageRow, OpenCodePartRow, OpenCodeSessionRow } from "./types.js";

export function resolveOpenCodeDbPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;

  const envPath = process.env.OPENCODE_DB;
  if (envPath) {
    if (envPath === ":memory:" || isAbsolute(envPath)) return envPath;
    return join(defaultOpenCodeDataDir(), envPath);
  }

  return join(defaultOpenCodeDataDir(), "opencode.db");
}

export class OpenCodeAdapter extends SourceAdapter<"opencode"> {
  constructor(private readonly defaultOptions: AdapterReadOptions = {}) {
    super("opencode");
  }

  listSessions(options: AdapterReadOptions = {}): AdapterSession<"opencode">[] {
    const db = openDatabase(
      resolveOpenCodeDbPath(readDbParam(options) ?? readDbParam(this.defaultOptions)),
    );
    try {
      return readSessionRows(db).map(sessionRowToRecord);
    } finally {
      db.close();
    }
  }

  getSession(
    externalId: string,
    options: AdapterReadOptions = {},
  ): AdapterSession<"opencode"> | null {
    const db = openDatabase(
      resolveOpenCodeDbPath(readDbParam(options) ?? readDbParam(this.defaultOptions)),
    );
    try {
      const row = readSessionRow(db, externalId);
      return row ? sessionRowToRecord(row) : null;
    } finally {
      db.close();
    }
  }

  listMessages(
    sessionExternalId?: string,
    options: AdapterReadOptions = {},
  ): AdapterMessage<"opencode">[] {
    const db = openDatabase(
      resolveOpenCodeDbPath(readDbParam(options) ?? readDbParam(this.defaultOptions)),
    );
    try {
      const messages = sessionExternalId
        ? readMessageRows(db).filter((message) => message.session_id === sessionExternalId)
        : readMessageRows(db);
      const parts = readPartRows(db);
      const partsByMessage = groupPartsByMessage(parts);
      return messages
        .filter((message) => messageRowSyncStatus(message) === "ready")
        .map((message) => messageRowToRecord(message, partsByMessage.get(message.id) ?? []));
    } finally {
      db.close();
    }
  }

  getMessage(
    externalId: string,
    options: AdapterReadOptions = {},
  ): AdapterMessage<"opencode"> | null {
    const db = openDatabase(
      resolveOpenCodeDbPath(readDbParam(options) ?? readDbParam(this.defaultOptions)),
    );
    try {
      const message = readMessageRow(db, externalId);
      if (!message || messageRowSyncStatus(message) !== "ready") return null;
      return messageRowToRecord(message, readPartRowsForMessage(db, message.id));
    } finally {
      db.close();
    }
  }

  getMessageSyncStatus(
    externalId: string,
    options: AdapterReadOptions = {},
  ): "ready" | "incomplete" | "missing" {
    const db = openDatabase(
      resolveOpenCodeDbPath(readDbParam(options) ?? readDbParam(this.defaultOptions)),
    );
    try {
      const message = readMessageRow(db, externalId);
      return message ? messageRowSyncStatus(message) : "missing";
    } finally {
      db.close();
    }
  }
}

export const opencodeAdapter = new OpenCodeAdapter();

function openDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:" && !existsSync(dbPath))
    throw new Error(`OpenCode database not found: ${dbPath}`);
  return new Database(dbPath, { readonly: true });
}

function readSessionRows(db: Database): OpenCodeSessionRow[] {
  return db
    .query<OpenCodeSessionRow, []>(
      `SELECT id, slug, directory, path, title, model, cost, tokens_input, tokens_output, time_created, time_updated
       FROM session
       WHERE time_archived IS NULL
       ORDER BY time_created ASC`,
    )
    .all();
}

function readSessionRow(db: Database, externalId: string): OpenCodeSessionRow | null {
  return db
    .query<OpenCodeSessionRow, [string]>(
      `SELECT id, slug, directory, path, title, model, cost, tokens_input, tokens_output, time_created, time_updated
       FROM session
       WHERE id = ? AND time_archived IS NULL`,
    )
    .get(externalId);
}

function readMessageRow(db: Database, externalId: string): OpenCodeMessageRow | null {
  return db
    .query<OpenCodeMessageRow, [string]>(
      `SELECT id, session_id, time_created, time_updated, data
       FROM message
       WHERE id = ?`,
    )
    .get(externalId);
}

function readPartRowsForMessage(db: Database, messageId: string): OpenCodePartRow[] {
  return db
    .query<OpenCodePartRow, [string]>(
      `SELECT id, message_id, session_id, time_created, time_updated, data
       FROM part
       WHERE message_id = ?
       ORDER BY time_created, id`,
    )
    .all(messageId);
}

function readMessageRows(db: Database): OpenCodeMessageRow[] {
  return db
    .query<OpenCodeMessageRow, []>(
      `SELECT id, session_id, time_created, time_updated, data
       FROM message
       ORDER BY session_id, time_created, id`,
    )
    .all();
}

function readPartRows(db: Database): OpenCodePartRow[] {
  return db
    .query<OpenCodePartRow, []>(
      `SELECT id, message_id, session_id, time_created, time_updated, data
       FROM part
       ORDER BY session_id, message_id, time_created, id`,
    )
    .all();
}

function groupPartsByMessage(parts: OpenCodePartRow[]): Map<string, OpenCodePartRow[]> {
  const partsByMessage = new Map<string, OpenCodePartRow[]>();
  for (const part of parts) {
    const existing = partsByMessage.get(part.message_id) ?? [];
    existing.push(part);
    partsByMessage.set(part.message_id, existing);
  }
  return partsByMessage;
}

function defaultOpenCodeDataDir(): string {
  return process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "opencode")
    : join(homedir(), ".local", "share", "opencode");
}

function readDbParam(options: AdapterReadOptions): string | undefined {
  return options.params?.db;
}

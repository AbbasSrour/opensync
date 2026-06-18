export type OpenCodeSessionRow = {
  id: string;
  slug?: string | null;
  directory?: string | null;
  path?: string | null;
  title?: string | null;
  model?: string | null;
  cost?: number | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  time_created: number;
  time_updated?: number | null;
};

export type OpenCodeMessageRow = {
  id: string;
  session_id: string;
  time_created: number;
  time_updated?: number | null;
  data: string;
};

export type OpenCodePartRow = {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  time_updated?: number | null;
  data: string;
};

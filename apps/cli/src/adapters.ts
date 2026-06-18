import { opencodeAdapter } from "@opensync/adapter-opencode";

export function adapterForSource(source: string): typeof opencodeAdapter | undefined {
  if (source === opencodeAdapter.source) return opencodeAdapter;
  return undefined;
}

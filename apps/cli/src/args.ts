export function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

export function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

export function adapterParams(args: string[], knownFlags: string[]): Record<string, string> {
  const known = new Set(knownFlags);
  const params: Record<string, string> = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg?.startsWith("--") || known.has(arg)) continue;

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!key || !value || value.startsWith("--")) continue;

    params[key] = value;
    index++;
  }

  return params;
}

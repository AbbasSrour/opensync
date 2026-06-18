declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options?: { readonly?: boolean });
    query<T, TParams extends unknown[] = unknown[]>(
      sql: string,
    ): { all(...params: TParams): T[]; get(...params: TParams): T | null };
    close(): void;
  }
}

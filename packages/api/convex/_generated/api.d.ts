/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as api_ from "../api.js";
import type * as crons from "../crons.js";
import type * as embeddings from "../embeddings.js";
import type * as evals from "../evals.js";
import type * as http from "../http.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_parts from "../lib/parts.js";
import type * as messages from "../messages.js";
import type * as rag from "../rag.js";
import type * as search from "../search.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";
import type * as wrapped from "../wrapped.js";
import type * as wrappedActions from "../wrappedActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  api: typeof api_;
  crons: typeof crons;
  embeddings: typeof embeddings;
  evals: typeof evals;
  http: typeof http;
  "lib/ai": typeof lib_ai;
  "lib/parts": typeof lib_parts;
  messages: typeof messages;
  rag: typeof rag;
  search: typeof search;
  sessions: typeof sessions;
  users: typeof users;
  wrapped: typeof wrapped;
  wrappedActions: typeof wrappedActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
};

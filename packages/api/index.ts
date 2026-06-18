// Re-export the generated Convex API + data model types so app code can import
// from "@opensync/api" instead of reaching into generated files.
export { api, internal, components } from "./convex/_generated/api.js";
export type { Id, Doc, TableNames, DataModel } from "./convex/_generated/dataModel.js";

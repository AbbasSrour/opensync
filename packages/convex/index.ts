// Re-export the generated Convex API + data model types so app code can import
// from "@opensync/convex" instead of reaching into generated files.
export { api, internal, components } from "./src/_generated/api.js";
export type { Id, Doc, TableNames, DataModel } from "./src/_generated/dataModel.js";

import { clearConfig } from "../config.js";

export function logoutCommand(): void {
  clearConfig();
  console.log("Logged out.");
}

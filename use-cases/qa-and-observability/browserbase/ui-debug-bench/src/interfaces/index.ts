import type { InterfaceName } from "../types.js";
import type { BrowserInterface } from "./base.js";
import { BrowseInterface } from "./browse.js";
import { StagehandActInterface } from "./stagehand-act.js";
import { StagehandCdpInterface } from "./stagehand-cdp.js";

export function createInterface(name: InterfaceName): BrowserInterface {
  if (name === "browse") return new BrowseInterface();
  if (name === "stagehand-act") return new StagehandActInterface();
  if (name === "stagehand-cdp") return new StagehandCdpInterface();
  throw new Error(`Unknown browser interface ${name as string}`);
}

import { launchCdpBrowser } from "../src/interfaces/cdp-launch.js";
const b = await launchCdpBrowser();
console.log("launched:", b.executable, "endpoint:", b.endpoint);
const res = await fetch(`http://127.0.0.1:${b.endpoint}/json/version`);
console.log("version ok:", res.ok);
await b.stop();

// Extracts the screenshots a managed-agent run captured, from its message stream.
// Reads a phase results.json (with runId + label per result), paginates
// listMessages(runId), and saves every image file-part to <outDir>/<label>/shot-NN.png.
// Reusable across RQ phases: `node pull-shots.mjs ./rq1/results.json ./rq1`
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import path from "path";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const RESULTS = process.argv[2] || "./rq1/results.json";
const OUT_DIR = process.argv[3] || path.dirname(RESULTS);

const { results } = JSON.parse(fs.readFileSync(RESULTS, "utf8"));
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

async function saveImage(dataOrUrl, dest) {
  if (/^https?:\/\//.test(dataOrUrl)) {
    const res = await fetch(dataOrUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  } else {
    const b64 = dataOrUrl.includes(",")
      ? dataOrUrl.split(",").pop()
      : dataOrUrl;
    fs.writeFileSync(dest, Buffer.from(b64, "base64"));
  }
}

for (const r of results) {
  if (!r.runId) continue;
  const dir = path.join(OUT_DIR, r.label);
  fs.mkdirSync(dir, { recursive: true });
  let since = undefined,
    n = 0,
    saved = 0;
  try {
    while (true) {
      const page = await bb.agents.runs.listMessages(
        r.runId,
        since ? { since } : {},
      );
      const msgs = page.data || [];
      for (const m of msgs) {
        for (const part of m.parts || []) {
          const isImg =
            part.type === "file" && (part.mediaType || "").startsWith("image/");
          if (isImg && part.data) {
            const ext = (part.mediaType.split("/")[1] || "png").replace(
              "jpeg",
              "jpg",
            );
            const dest = path.join(
              dir,
              `shot-${String(++n).padStart(2, "0")}.${ext}`,
            );
            try {
              await saveImage(part.data, dest);
              saved++;
            } catch (e) {
              log(`  save fail ${r.label} #${n}: ${e.message}`);
            }
          }
        }
      }
      if (!page.nextSince || page.nextSince === since || msgs.length === 0)
        break;
      since = page.nextSince;
    }
    log(`${r.label}: saved ${saved} screenshots → ${dir}`);
  } catch (e) {
    log(`${r.label}: listMessages error — ${e.message || e}`);
  }
}

import "dotenv/config";
import { browserbase, Stagehand, type Page } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { z } from "zod/v4";

const JOB_BOARD_URL = "https://agent-job-board.vercel.app/";
const JobInfoSchema = z.object({ url: z.string().url(), title: z.string().trim().min(1) });
type JobInfo = z.infer<typeof JobInfoSchema>;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateJobUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== new URL(JOB_BOARD_URL).origin || url.username || url.password ||
      !/^\/jobs\/[0-9]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("Expected a specific job URL on the demo board");
  }
}

async function withSession<T>(run: (stagehand: Stagehand, page: Page) => Promise<T>): Promise<T> {
  const browser = await browserbase.launch({ apiKey: requireEnv("BROWSERBASE_API_KEY") });
  try {
    const stagehand = await Stagehand.create({ browser, model: { modelName: "google/gemini-2.5-flash" } });
    try {
      const page = (await browser.context.pages())[0] ?? await browser.context.newPage();
      return await run(stagehand, page);
    } finally {
      await stagehand.close();
    }
  } finally {
    await browser.close();
  }
}

async function checkedAct(stagehand: Stagehand, page: Page, instruction: string) {
  const result = await stagehand.act(instruction, { page });
  if (result.data.success !== true) throw new Error("A required job-board action failed");
}

type ApplicationState = {
  name: string | null; email: string | null; region: string | null;
  resume: { name: string; size: number; type: string } | null;
  multiRegion: boolean; headings: string[]; paragraphs: string[]; formCount: number;
};

async function applicationState(page: Page): Promise<ApplicationState> {
  return await page.evaluate("(() => {\n      const unique = selector => {\n        const elements = document.querySelectorAll(selector);\n        return elements.length === 1 ? elements[0] : null;\n      };\n      const visible = element => element && element.getClientRects().length > 0 &&\n        getComputedStyle(element).visibility !== 'hidden';\n      const field = selector => {\n        const element = unique(selector);\n        return visible(element) ? element.value : null;\n      };\n      const upload = unique('#resume');\n      const file = upload?.files?.length === 1 ? upload.files[0] : null;\n      const yes = unique('#yes');\n      return {\n        name: field('#name'), email: field('#email'), region: field('#location'),\n        resume: file ? {name: file.name, size: file.size, type: file.type} : null,\n        multiRegion: visible(yes) && (yes.checked === true || yes.getAttribute('aria-checked') === 'true'),\n        headings: [...document.querySelectorAll('h2')].filter(visible).map(e => e.innerText.trim()),\n        paragraphs: [...document.querySelectorAll('p')].filter(visible).map(e => e.innerText.trim()),\n        formCount: [...document.querySelectorAll('form')].filter(visible).length\n      };\n    })()") as ApplicationState;
}

export async function getProjectConcurrency(): Promise<number> {
  const bb = new Browserbase({ apiKey: requireEnv("BROWSERBASE_API_KEY") });
  const project = await bb.projects.retrieve(requireEnv("BROWSERBASE_PROJECT_ID"));
  if (!Number.isInteger(project.concurrency) || project.concurrency < 1) {
    throw new Error("Project concurrency must be a positive integer");
  }
  return Math.min(project.concurrency, 5);
}

export function generateRandomEmail(): string {
  // Generate a random email address for form submission
  const randomString = Math.random().toString(36).substring(2, 10);
  return `agent-${randomString}@example.com`;
}

export function generateAgentId(): string {
  // Generate a unique agent identifier for job applications
  // Combines timestamp and random string to ensure uniqueness
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createSemaphore(maxConcurrency: number) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) throw new Error("Concurrency must be a positive integer");
  // Semaphore implementation for concurrency control
  // Ensures we don't exceed Browserbase project limits when applying to multiple jobs
  let activeCount = 0;
  const queue: (() => void)[] = [];

  const semaphore = () =>
    new Promise<void>((resolve) => {
      if (activeCount < maxConcurrency) {
        activeCount++;
        resolve();
      } else {
        queue.push(resolve);
      }
    });

  const release = () => {
    activeCount--;
    if (queue.length > 0) {
      const next = queue.shift()!;
      activeCount++;
      next();
    }
  };

  return { semaphore, release };
}

export async function applyToJob(job: JobInfo, semaphore: () => Promise<void>, release: () => void) {
  validateJobUrl(job.url);
  await semaphore();
  try {
    await withSession(async (stagehand, page) => {
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const agentId = generateAgentId();
      const email = generateRandomEmail();
      await checkedAct(stagehand, page, `Fill the agent identifier field with ${agentId}`);
      await checkedAct(stagehand, page, `Fill the contact endpoint field with ${email}`);
      await checkedAct(stagehand, page, "Fill the deployment region field with us-west-2");
      const { data: uploads } = await stagehand.observe("Find the file input for the agent profile or resume", { page });
      if (uploads.length !== 1 || !uploads[0].selector) throw new Error("Could not locate one resume upload input");
      const upload = page.locator(uploads[0].selector);
      if (await upload.count() !== 1) throw new Error("Resume upload input is not unique");
      const response = await fetch(`${JOB_BOARD_URL}Agent%20Resume.pdf`, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Resume download failed: HTTP ${response.status}`);
      const resume = Buffer.from(await response.arrayBuffer());
      if (resume.subarray(0, 4).toString() !== "%PDF" || resume.length > 5 * 1024 * 1024) {
        throw new Error("Expected a PDF resume of at most 5 MiB");
      }
      await upload.setInputFiles({ name: "Agent Resume.pdf", mimeType: "application/pdf", buffer: resume });
      await checkedAct(stagehand, page, "Select Yes for multi-region deployment");
      const before = await applicationState(page);
      if (await page.url() !== job.url || before.name !== agentId || before.email !== email ||
          before.region !== "us-west-2" || before.resume?.name !== "Agent Resume.pdf" ||
          before.resume?.size !== resume.length || before.resume?.type !== "application/pdf" ||
          before.multiRegion !== true || before.formCount !== 1 || before.headings.includes("Deployment Request Submitted!")) {
        throw new Error("Application fields or resume were not confirmed before submission");
      }
      await checkedAct(stagehand, page, "Click the Deploy Agent button");
      for (let attempt = 0; attempt < 20; attempt++) {
        const after = await applicationState(page);
        const messages = after.paragraphs.filter(text => text.startsWith(`Your application for ${job.title} at `) &&
          text.endsWith(" has been received. Deployment protocols will be initiated soon."));
        if (await page.url() === job.url && after.formCount === 0 && after.headings.length === 1 &&
            after.headings[0] === "Deployment Request Submitted!" && messages.length === 1) return;
        await page.waitForTimeout(250);
      }
      throw new Error("Demo submission confirmation was not observed; do not retry blindly");
    });
    console.log(`[${job.title}] Demo submission confirmed locally; no hiring-service delivery`);
    return job.title;
  } finally {
    release();
  }
}

async function main() {
  const maxConcurrency = await getProjectConcurrency();
  const jobs = await withSession(async (stagehand, page) => {
    await page.goto(JOB_BOARD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await checkedAct(stagehand, page, "Click the View Jobs button");
    const { data } = await stagehand.extract("Extract every visible job listing with its title and absolute URL", z.array(JobInfoSchema), { page });
    const jobs = z.array(JobInfoSchema).min(1).parse(data);
    for (const job of jobs) validateJobUrl(job.url);
    return jobs;
  });
  const { semaphore, release } = createSemaphore(maxConcurrency);
  const results = await Promise.allSettled(jobs.map(job => applyToJob(job, semaphore, release)));
  const failures = results.filter(result => result.status === "rejected");
  console.log(`Confirmed ${results.length - failures.length} of ${jobs.length} demo submissions`);
  if (failures.length) throw new Error(`${failures.length} of ${jobs.length} demo applications failed`);
  console.log("All demo confirmations checked; no hiring-service delivery was performed");
}

main().catch((error) => {
  console.error("Job application automation failed:", error);
  process.exitCode = 1;
});

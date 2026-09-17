import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { open } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod/v4";

async function main() {
  const requiredText = z.string().trim().min(1);
  const profile = z.object({
    url: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    firstName: requiredText,
    lastName: requiredText,
    email: z.string().trim().email(),
    headline: requiredText,
    phone: requiredText,
    address: requiredText,
    resumePath: requiredText,
    salaryExpectations: requiredText,
  }).safeParse({
    url: process.env.JOB_URL,
    firstName: process.env.JOB_FIRST_NAME,
    lastName: process.env.JOB_LAST_NAME,
    email: process.env.JOB_EMAIL,
    headline: process.env.JOB_HEADLINE,
    phone: process.env.JOB_PHONE,
    address: process.env.JOB_ADDRESS,
    resumePath: process.env.JOB_RESUME_PATH,
    salaryExpectations: process.env.JOB_SALARY_EXPECTATIONS,
  });
  if (!profile.success) {
    throw new Error("Set the required JOB_* inputs, a valid email, and an HTTP(S) job URL.");
  }

  const maxResumeBytes = 5 * 1024 * 1024;
  const resumeFile = await open(profile.data.resumePath, "r");
  let resume: Buffer;
  try {
    const stat = await resumeFile.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > maxResumeBytes) {
      throw new Error("The resume must be a nonempty PDF file of at most 5 MiB.");
    }
    const buffer = Buffer.alloc(maxResumeBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await resumeFile.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    resume = buffer.subarray(0, length);
    if (length > maxResumeBytes || resume.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("The resume must have a PDF header and be at most 5 MiB.");
    }
  } finally {
    await resumeFile.close();
  }
  const resumeName = basename(profile.data.resumePath);

  const browser = await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY! });
  let stagehand: Awaited<ReturnType<typeof Stagehand.create>> | undefined;
  try {
    stagehand = await Stagehand.create({ browser });
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error("No browser page is available.");
    await page.goto(profile.data.url);

    const act = async (instruction: string, variables: Record<string, string> = {}) => {
      const result = await stagehand!.act(
        `${instruction}. Only prepare the application; do not submit it or click any final submit button.`,
        { page, variables },
      );
      if (result.data.success !== true) throw new Error("Application preparation action failed.");
    };
    await act("Accept cookies if a cookie banner is present; otherwise make no change");
    await act("Click apply now to open the application form");
    await act("Type %firstName% into the first name field", { firstName: profile.data.firstName });
    await act("Type %lastName% into the last name field", { lastName: profile.data.lastName });
    await act("Type %email% into the email field", { email: profile.data.email });
    await act("Type %headline% into the headline field", { headline: profile.data.headline });
    await act("Type %phone% into the phone field", { phone: profile.data.phone });
    await act("Type %address% into the address field", { address: profile.data.address });

    const resumeInput = page.locator('input[type="file"]');
    if (await resumeInput.count() !== 1) throw new Error("Expected exactly one resume upload input.");
    await resumeInput.setInputFiles({ name: resumeName, mimeType: "application/pdf", buffer: resume });
    const uploaded = await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      if (inputs.length !== 1 || inputs[0].files?.length !== 1) return null;
      const file = inputs[0].files[0];
      return { name: file.name, size: file.size, type: file.type };
    });
    if (!uploaded || uploaded.name !== resumeName || uploaded.size !== resume.length || uploaded.type !== "application/pdf") {
      throw new Error("The resume upload could not be verified.");
    }
    await act("Type %salaryExpectations% into the salary expectations field", {
      salaryExpectations: profile.data.salaryExpectations,
    });
  } finally {
    try {
      await stagehand?.close();
    } finally {
      await browser.close();
    }
  }
  console.log("Stagehand reported field preparation and the resume input contained the selected file. Site-specific questions still require human review. No submit action was requested.");
}

main().catch(() => {
  console.error("Application preparation failed. Check the JOB_* inputs, PDF resume, and browser configuration.");
  process.exitCode = 1;
});

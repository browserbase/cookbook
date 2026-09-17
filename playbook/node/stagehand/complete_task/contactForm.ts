import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v4";

async function main() {
  const contact = z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).safeParse({
    name: process.env.CONTACT_NAME,
    email: process.env.CONTACT_EMAIL,
    phone: process.env.CONTACT_PHONE,
    message: process.env.CONTACT_MESSAGE,
  });
  if (!contact.success) {
    throw new Error(
      "Set nonblank CONTACT_NAME, CONTACT_EMAIL, CONTACT_PHONE, and CONTACT_MESSAGE; CONTACT_EMAIL must be a valid email address.",
    );
  }

  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  let stagehand: Awaited<ReturnType<typeof Stagehand.create>> | undefined;
  try {
    stagehand = await Stagehand.create({ browser });
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error("No browser page is available.");

    console.log(`Session recording: https://browserbase.com/sessions/${browser.sessionId}`);
    await page.goto("https://www.browserbase.com/contact");
    const result = await stagehand.act(
      "Fill in the fields with name: %name% email: %email% phone: %phone% message: %message%. Only prepare the form; do not submit it or click any send or submit button.",
      { page, variables: contact.data },
    );
    if (result.data.success !== true) {
      throw new Error("Contact form preparation failed.");
    }
  } finally {
    try {
      await stagehand?.close();
    } finally {
      await browser.close();
    }
  }
  console.log("Stagehand reported form preparation. No submit action was requested.");
}

main().catch(() => {
  console.error("Contact form preparation failed. Check the required CONTACT_* inputs and browser configuration.");
  process.exitCode = 1;
});

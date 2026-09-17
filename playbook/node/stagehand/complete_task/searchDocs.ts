import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import { z } from "zod/v4";

async function main() {
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const stagehand = await Stagehand.create({
    browser,
    model: {
      modelName: "google/gemini-2.0-flash",
      ...{
        apiKey: process.env.GOOGLE_API_KEY,
      },
    },
  });

  // Initialize the stagehand instance

  const page = (await browser.context.pages())[0];

  // If running in Browserbase, print a link to the session
  if (browser.provider === "browserbase" && browser.sessionId) {
    console.log(
      boxen(
        `View this session live in your browser: \n${`https://browserbase.com/sessions/${browser.sessionId}`}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  // Define the question and the URL of the docs
  const question = "Tell me, in one sentence, why I should use Stagehand";
  const docsUrl = "https://docs.stagehand.dev/reference/introduction";

  // Navigate to the docs URL
  await page.goto(docsUrl);

  // Click on the search bar
  await stagehand.act("click on the search bar");

  // Type the question into the search bar and click on the suggestion that says 'Use AI to answer your question'
  await stagehand.act(
    `type '${question}' into the search bar and click on the suggestion that says 'Use AI to answer your question'`,
  );

  // Wait for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Extract the response from the chatbot
  const { text } = (
    await stagehand.extract(
      "extract the response from the chatbot",
      z.object({
        text: z.string(),
      }),
    )
  ).data;

  // Log the question and the answer
  console.log(
    "\n\n" +
      chalk.gray("Question: ") +
      question +
      "\n" +
      chalk.green("Answer from Mintlify AI: ") +
      text +
      "\n\n",
  );

  // Close the stagehand instance
  await stagehand.close();
  await browser.close();
}

main();

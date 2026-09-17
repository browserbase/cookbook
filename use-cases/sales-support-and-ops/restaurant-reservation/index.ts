import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { stripScreenshots, formatPhoneNumber } from "./shared/utils";
import { runBrowserTask, resolveBrowserAgentModel } from "./browser-task.js";

const parametersSchema = z.object({
  restaurantName: z
    .string()
    .min(1)
    .describe("Restaurant name to search for in San Francisco"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Reservation date in YYYY-MM-DD format"),
  time: z.string().describe("Reservation time (e.g., '19:00' or '7:00 PM')"),
  partySize: z.number().min(1).max(20).describe("Number of people (1-20)"),
  guestFirstName: z.string().min(1).describe("Guest first name"),
  guestLastName: z.string().min(1).describe("Guest last name"),
  guestEmail: z.string().email().describe("Guest email address"),
  guestPhoneNumber: z.string().describe("Guest phone number"),
  specialRequests: z.string().optional().describe("Special requests or notes"),
  apiKey: z.string().trim().min(1).describe("Stagehand primitive model API key"),
  agentApiKey: z.string().trim().min(1).describe("OpenAI API key for the outer tool-calling agent"),
  agentModel: z.string().optional().describe("Bare OpenAI model ID for the outer agent (default: gpt-5.4-mini)"),
  model: z
    .string()
    .optional()
    .describe("AI model to use (default: anthropic/claude-sonnet-4-20250514)"),
  maxSteps: z
    .number()
    .optional()
    .describe("Maximum steps for agent execution (default: 50)"),
});

defineFn(
  "book-reservation",
  async (context, params) => {
    const { session } = context;
    const startTime = Date.now();

    // Type assertion for params
    const typedParams = parametersSchema.parse(params);

    try {
      const agentModel = resolveBrowserAgentModel({ apiKey: typedParams.agentApiKey, model: typedParams.agentModel ?? "gpt-5.4-mini" });
      console.log("Connecting to browser session:", session.id);
      console.log(
        `Booking reservation for ${typedParams.guestFirstName} ${typedParams.guestLastName}`,
      );

      // Connect to the browser instance
      const browser = await chromium.connectOverCDP(session.connectUrl);
      const browserContext = browser.contexts()[0]!;
      const page = browserContext.pages()[0]!;

      // Navigate to reservation portal homepage
      console.log("Navigating to: https://reservations.example.invalid");
      await page.goto("https://reservations.example.invalid", {
        waitUntil: "domcontentloaded",
      });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Configure Stagehand to use the existing browser session
      const stagehand = await Stagehand.create(
        StagehandCreateOptionsSchema.parse({
          browser: await localBrowser.connect({ cdpUrl: session.connectUrl }),
          model: {
            modelName:
              typedParams.model ?? "anthropic/claude-sonnet-4-20250514",
            apiKey: typedParams.apiKey,
          },
        }),
      );

      console.log("Stagehand initialized, processing reservation booking...");

      // Use Stagehand agent to complete the booking
      const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
        runBrowserTask(stagehand!, task, {
          model: agentModel,
          systemPrompt: `You are a helpful assistant that completes reservation portal restaurant reservations using guest checkout. You MUST use guest checkout - do not attempt to log in with credentials.`,
        });

      const formattedPhone = formatPhoneNumber(typedParams.guestPhoneNumber);

      const specialRequestsInstructions = typedParams.specialRequests
        ? `\n   - Special requests: "${typedParams.specialRequests}"`
        : "";

      const result = await agent({
        instruction: `Complete a guest reservation booking on reservation portal following these steps:

STEP 1: SEARCH FOR RESTAURANT
1. You are on reservation portal.com homepage
2. Search for "${typedParams.restaurantName}" in "San Francisco, CA"
3. Find the restaurant and select the time slot for ${typedParams.time} with ${typedParams.partySize} people on ${typedParams.date}
4. Click to proceed to the booking form
5. If there are multiple seating options available (such as standard, outdoor, etc.), select the standard option if available. If not, select the best available option.

STEP 2: FILL GUEST INFORMATION FORM
Look for the reservation form and fill in these details:
   - First name: ${typedParams.guestFirstName}
   - Last name: ${typedParams.guestLastName}
   - Email: ${typedParams.guestEmail}
   - Phone number: ${formattedPhone}${specialRequestsInstructions}

IMPORTANT: If you see options for "Sign in" vs "Continue as guest", ALWAYS choose "Continue as guest" or "Guest checkout".
Do NOT attempt to log in or create an account.

STEP 3: CHECK FOR CREDIT CARD REQUIREMENT
Before proceeding, check if the form requires credit card information:
   - Look for fields like "Card number", "CVV", "Expiration date", or "Credit card"
   - If credit card is required, set "creditCardRequired": true and do NOT proceed with submission
   - If no credit card is required, proceed to Step 4

STEP 4: REVIEW DETAILS (only if no credit card required)
Before submitting, verify:
   - Restaurant name: ${typedParams.restaurantName}
   - Location: San Francisco, CA
   - Date: ${typedParams.date}
   - Time: ${typedParams.time}
   - Party size: ${typedParams.partySize} people
   - Guest information is correct

STEP 5: SUBMIT RESERVATION (only if no credit card required)
Click the button to complete/confirm the reservation (e.g., "Complete reservation", "Confirm", "Reserve now")

STEP 6: EXTRACT CONFIRMATION (only if submission succeeded)
After submission, extract:
   - Confirmation number (if shown)
   - Restaurant details (name, address, phone)
   - Final reservation details (date, time, party size)
   - Cancellation policy (if shown)

ERROR HANDLING:
If the time slot becomes unavailable or there's an error:
   - Note the specific error message
   - Check if alternative time slots are suggested
   - Extract any available alternatives

Return a JSON object with this structure:
{
  "creditCardRequired": true/false,
  "confirmed": true/false,
  "confirmationNumber": "ABC123" or null,
  "restaurant": {
    "name": "Restaurant Name",
    "address": "Full Address",
    "phone": "Phone Number"
  },
  "reservation": {
    "date": "${typedParams.date}",
    "time": "${typedParams.time}",
    "partySize": ${typedParams.partySize}
  },
  "guest": {
    "name": "${typedParams.guestFirstName} ${typedParams.guestLastName}",
    "email": "${typedParams.guestEmail}",
    "phone": "${formattedPhone}"
  },
  "cancellationPolicy": "Policy text if available",
  "error": "Error message if booking failed",
  "message": "User-friendly message explaining the result"
}

IMPORTANT: If creditCardRequired is true, do not attempt to submit the reservation. Set confirmed to false and include a clear message explaining that a credit card is required.`,
        maxSteps: typedParams.maxSteps ?? 50,
      });

      console.log("Agent execution completed");

      // Strip screenshots from actions
      const agentResult = result as any;
      const actions = stripScreenshots(agentResult?.actions ?? []);

      // Parse the message as JSON if possible
      let parsedData: any = {};
      try {
        if (agentResult?.message) {
          parsedData = JSON.parse(agentResult.message);
        }
      } catch (e) {
        console.warn("Could not parse agent message as JSON:", e);
        parsedData = { message: agentResult?.message };
      }

      const successResponse: any = {
        success: agentResult?.success ?? false,
        creditCardRequired: parsedData.creditCardRequired ?? false,
        confirmed: parsedData.confirmed ?? false,
        confirmationNumber: parsedData.confirmationNumber ?? "",
        restaurant: parsedData.restaurant ?? {},
        reservation: parsedData.reservation ?? {},
        guest: parsedData.guest ?? {},
        cancellationPolicy: parsedData.cancellationPolicy ?? "",
        error: parsedData.error ?? "",
        message: parsedData.message ?? "",
        availableAlternatives: parsedData.availableAlternatives ?? [],
        actions,
        sessionReplayUrl: `https://www.browserbase.com/sessions/${session.id}`,
        duration: Date.now() - startTime,
      };

      return successResponse;
    } catch (error) {
      console.error("Book reservation failed:", error);

      const errorResponse: any = {
        success: false,
        creditCardRequired: false,
        confirmed: false,
        confirmationNumber: "",
        restaurant: {},
        reservation: {},
        guest: {},
        cancellationPolicy: "",
        error: error instanceof Error ? error.message : String(error),
        message: "An unexpected error occurred",
        availableAlternatives: [],
        actions: [],
        sessionReplayUrl: `https://www.browserbase.com/sessions/${session.id}`,
        duration: Date.now() - startTime,
      };

      return errorResponse;
    }
  },
  {
    parametersSchema,
    sessionConfig: {
      browserSettings: {
        verified: true,
        blockAds: true,
        solveCaptchas: true,
      },
      api_timeout: 300, // 5 minutes (in seconds)
    },
  },
);

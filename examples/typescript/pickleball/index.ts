// SF Court Booking Automation - See README.md for full documentation
import "dotenv/config";
import { browserbase, Stagehand, type Page } from "@browserbasehq/stagehand";
import inquirer from "inquirer";
import { z } from "zod/v4";
import { selectCalendarDate } from "./calendar-selection.js";
import { calendarDateOptions, formatCalendarDate } from "./calendar-dates.js";
import { bookingReceiptSchema, reviewedBookingSchema, validateBookingIntent, validateReviewedBooking, validateBookingReceipt, type BookingIntent, type BookingReceipt } from "./booking-contract.js";

async function loginToSite(stagehand: Stagehand, email: string, password: string): Promise<void> {
  console.log("Logging in...");
  // Perform login sequence: each step is atomic to handle dynamic page changes.
  await stagehand.act("Click the Login button");
  await stagehand.act(`Fill in the email or username field with "${email}"`);
  await stagehand.act("Click the next, continue, or submit button to proceed");
  await stagehand.act(`Fill in the password field with "${password}"`);
  await stagehand.act("Click the login, sign in, or submit button");
  console.log("Logged in");
}

async function selectFilters(
  stagehand: Stagehand,
  page: Page,
  activity: string,
  timeOfDay: string,
  selectedDate: string,
): Promise<void> {
  console.log("Selecting the activity");
  // Filter by activity type first to narrow down available courts.
  await stagehand.act(`Click the activites drop down menu`, { page });
  await stagehand.act(`Select the ${activity} activity`, { page });
  await stagehand.act(`Click the Done button`, { page });

  console.log(`Selecting time of day: ${timeOfDay}`);
  // Filter by time period to find courts available during preferred hours.
  await stagehand.act(`Click the time filter or time selection dropdown`, { page });
  await stagehand.act(`Select ${timeOfDay} time period`, { page });
  await stagehand.act(`Click the Done button`, { page });

  // Apply additional filters to show only available courts that accept reservations.
  await stagehand.act(`Click Available Only button`, { page });
  await stagehand.act(`Click All Facilities dropdown list`, { page });
  await stagehand.act(`Select Accept Reservations checkbox`, { page });
  await stagehand.act(`Click the Done button`, { page });
  await selectCalendarDate(stagehand, page, selectedDate);
}

async function checkAndExtractCourts(stagehand: Stagehand, page: Page, intent: BookingIntent): Promise<void> {
  const { data } = await stagehand.extract(
    `Are there selectable reservation slots for ${intent.activity} on ${intent.date} during ${intent.timeOfDay}? Do not count next-available suggestions, opening hours, or unavailable slots.`,
    z.object({ hasSelectableSlots: z.boolean() }),
    { page },
  );
  if (data?.hasSelectableSlots !== true) {
    throw new Error("No available reservation was found for the requested date and time period");
  }
}

async function bookCourt(stagehand: Stagehand, page: Page, intent: BookingIntent): Promise<BookingReceipt> {
  async function checkedAct(instruction: string): Promise<void> {
    const result = await stagehand.act(instruction, { page });
    if (result?.data?.success !== true) {
      throw new Error("Booking action failed or its outcome could not be verified");
    }
  }

  await checkedAct(`Open an available ${intent.activity} reservation slot for ${intent.date} during ${intent.timeOfDay}. Do not book or submit it.`);
  await checkedAct("Open the participant dropdown without submitting the reservation");
  const { data: participantData } = await stagehand.extract(
    "List the selectable named participants in the open dropdown. Do not infer participants.",
    z.object({ participants: z.array(z.string().trim().min(1)).min(1) }), { page },
  );
  const participants = z.array(z.string().trim().min(1)).min(1).parse(participantData?.participants);
  if (new Set(participants).size !== participants.length) throw new Error("Participant choices are ambiguous");
  const participantAnswer = await inquirer.prompt([{
    type: "list", name: "participant", message: "Who is this reservation for?", choices: participants,
  }]);
  if (!participants.includes(participantAnswer.participant)) throw new Error("Invalid participant selection");
  await checkedAct(`Select the participant named exactly ${JSON.stringify(participantAnswer.participant)}. Do not submit the reservation.`);

  const summaryInstruction = "Read the selected reservation summary before submission: activity, full date YYYY-MM-DD, court, facility, start and end HH:mm in San Francisco, selected participant, and full displayed price including currency and fees. Copy the existing reservationId if present, otherwise null. Do not infer missing details or submit anything.";
  const summarySchema = reviewedBookingSchema.extend({ reservationId: z.string().trim().min(1).nullable() });
  const { data: summary } = await stagehand.extract(summaryInstruction, summarySchema, { page });
  const reviewed = validateReviewedBooking(summary, intent);
  if (reviewed.participant !== participantAnswer.participant.trim()) {
    throw new Error("The selected participant differs from the requested participant");
  }
  const previousReservationId = z.string().trim().min(1).nullable().parse(summary.reservationId);
  console.log(`Review reservation: ${reviewed.activity}, ${reviewed.date}, ${reviewed.start}–${reviewed.end} America/Los_Angeles; ${reviewed.court}, ${reviewed.facility}; participant: ${reviewed.participant}; price: ${reviewed.price}`);
  const approval = await inquirer.prompt([{
    type: "confirm", name: "approved", message: "Submit this exact reservation at the displayed price?", default: false,
  }]);
  if (approval.approved !== true) throw new Error("Reservation cancelled before submission");

  const { data: refreshedSummary } = await stagehand.extract(summaryInstruction, summarySchema, { page });
  const refreshed = validateReviewedBooking(refreshedSummary, intent);
  for (const field of ["activity", "date", "timeOfDay", "court", "facility", "start", "end", "participant", "price"] as const) {
    if (refreshed[field] !== reviewed[field]) throw new Error(`Reservation ${field} changed after review; nothing was submitted`);
  }
  if (summarySchema.parse(refreshedSummary).reservationId !== previousReservationId) {
    throw new Error("Reservation identifier changed after review; nothing was submitted");
  }
  await checkedAct("Click the book, reserve, or confirm booking button for the reviewed reservation");
  await checkedAct("Click the Send Code Button");
  const codeAnswer = await inquirer.prompt([{
    type: "password", name: "verificationCode", message: "Please enter the verification code you received:",
    validate: (input: string) => input.trim() ? true : "Please enter a verification code",
  }]);
  await checkedAct(`Fill in the verification code field with ${JSON.stringify(codeAnswer.verificationCode)}`);
  await checkedAct("Click the confirm button");

  const outcomeSchema = z.object({ confirmed: z.boolean(), errorMessage: z.string().nullable() });
  const { data: extractedOutcome } = await stagehand.extract(
    "Check the immediate booking result. Set confirmed only for an explicit successful reservation confirmation. Copy any booking rejection or error into errorMessage, even when success text also appears. Missing or ambiguous confirmation means confirmed false.",
    outcomeSchema, { page },
  );
  const outcome = outcomeSchema.parse(extractedOutcome);
  if (outcome.errorMessage?.trim()) throw new Error(`Booking rejected: ${outcome.errorMessage.trim()}`);
  if (!outcome.confirmed) throw new Error("Booking outcome is unknown: no explicit reservation confirmation");

  await checkedAct("Open the newly created reservation details in the Rec profile. Do not create, edit, cancel, or pay for another reservation. If the new reservation cannot be identified unambiguously, stop.");
  const { data: confirmation } = await stagehand.extract(
    "Read the newly completed reservation receipt only. Extract its explicit confirmed status, reservationId, activity, date YYYY-MM-DD, court, facility, start/end HH:mm in San Francisco, participant and full price. Copy all visible text of that same receipt into visibleReceiptText verbatim. Set errorMessage for any booking rejection/error, even when a success message also appears. Missing identity, unrelated or ambiguous receipts must not be treated as confirmed. Do not infer a receipt from action success.",
    bookingReceiptSchema, { page },
  );
  return validateBookingReceipt(confirmation, reviewed, previousReservationId);
}

async function selectActivity(): Promise<string> {
  // Prompt user to select between Tennis and Pickleball activities.
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "activity",
      message: "Please select an activity:",
      choices: [
        { name: "Tennis", value: "Tennis" },
        { name: "Pickleball", value: "Pickleball" },
      ],
      default: 0,
    },
  ]);

  console.log(`Selected: ${answers.activity}`);
  return answers.activity;
}

async function selectTimeOfDay(): Promise<string> {
  // Prompt user to select preferred time period for court booking.
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "timeOfDay",
      message: "Please select the time of day:",
      choices: [
        { name: "Morning (Before 12 PM)", value: "Morning" },
        { name: "Afternoon (After 12 PM)", value: "Afternoon" },
        { name: "Evening (After 5 PM)", value: "Evening" },
      ],
      default: 0,
    },
  ]);

  console.log(`Selected: ${answers.timeOfDay}`);
  return answers.timeOfDay;
}

async function selectDate(): Promise<string> {
  const dateOptions = calendarDateOptions();

  // Prompt user to select from available date options.
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "selectedDate",
      message: "Please select a date:",
      choices: dateOptions,
      default: 0,
    },
  ]);

  console.log(`Selected: ${formatCalendarDate(answers.selectedDate)} (San Francisco)`);
  return answers.selectedDate;
}

async function bookTennisPaddleCourt(): Promise<BookingReceipt> {
  console.log("Starting tennis/paddle court booking automation in SF...");

  // Load credentials from environment variables for SF Rec & Parks login.
  const email = process.env.SF_REC_PARK_EMAIL;
  const password = process.env.SF_REC_PARK_PASSWORD;
  const _debugMode = process.env.DEBUG === "true";

  // Collect user preferences for activity, date, and time selection.
  const activity = await selectActivity();
  const selectedDate = await selectDate();
  const timeOfDay = await selectTimeOfDay();
  const intent = validateBookingIntent({ activity, date: selectedDate, timeOfDay });

  console.log(`Booking ${activity} courts in San Francisco for ${timeOfDay} on ${selectedDate}...`);

  // Validate that required credentials are available before proceeding.
  if (!email || !password) {
    throw new Error("Missing SF_REC_PARK_EMAIL or SF_REC_PARK_PASSWORD environment variables");
  }

  // Initialize Stagehand with Browserbase for AI-powered browser automation.
  console.log("Initializing Stagehand with Browserbase");
  const browser = await browserbase.launch({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    api_timeout: 900,
    region: "us-west-2",
  });
  const stagehand = await Stagehand.create({
    browser: browser,
    model: { modelName: "openai/gpt-4.1" },
    logging: { level: "info" },
  });

  try {
    // Start browser session and connect to SF Rec & Parks booking system.

    console.log("Browserbase Session Started");
    const page = (await browser.context.pages())[0];

    // Navigate to SF Rec & Parks booking site with extended timeout for slow loading.
    console.log("Navigating to court booking site...");
    await page.goto("https://www.rec.us/organizations/san-francisco-rec-park", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Execute booking workflow: login, filter, find courts, and complete booking.
    await loginToSite(stagehand, email, password);
    await selectFilters(stagehand, page, activity, timeOfDay, selectedDate);
    await checkAndExtractCourts(stagehand, page, intent);
    await selectCalendarDate(stagehand, page, selectedDate);
    return await bookCourt(stagehand, page, intent);
  } catch (error) {
    console.error("Error during court booking:", error);
    throw error;
  } finally {
    // Always close browser session to release resources and clean up.
    await stagehand.close();
    await browser.close();
    console.log("\nBrowser session closed");
  }
}

async function main() {
  // Display welcome message and explain the automation workflow to user.
  console.log("Welcome to SF Court Booking Automation!");
  console.log("");
  console.log("This tool automates tennis and pickleball court bookings in San Francisco.");
  console.log("Here's what we'll do:");
  console.log("");
  console.log("1. Navigate to https://www.rec.us/organizations/san-francisco-rec-park");
  console.log("2. Use automated login with your credentials");
  console.log("3. Select your preferred activity, date, and time");
  console.log("4. Review the court, participant, time, and price before approving submission");
  console.log("5. Handle verification codes and confirmation");
  console.log("");

  try {
    // Execute the complete court booking automation workflow.
    const receipt = await bookTennisPaddleCourt();

    console.log(`Reservation ${receipt.reservationId} confirmed: ${receipt.court}, ${receipt.facility}, ${receipt.date} ${receipt.start}–${receipt.end} America/Los_Angeles; ${receipt.participant}; ${receipt.price}`);
  } catch (error) {
    console.log("Failed to complete court booking");
    console.log(`Error: ${error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Application error:", err);
  console.log("Check your environment variables");
  process.exit(1);
});

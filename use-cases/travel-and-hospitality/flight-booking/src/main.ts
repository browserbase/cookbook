import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import {
  BookingConfig,
  FlightSearchResult,
  FlightSearchResultSchema,
  AirlinePortalAutomationError,
} from "./types";
import {
  validateBookingConfig,
  formatDateForAirlinePortal,
  getAirportName,
  processFlightData,
  calculateDuration,
  logProgress,
  retryOperation,
} from "./utils";
import { runBrowserTask } from "./../browser-task.js";
import { assertFlightResultMatchesRequest } from "./flight-result-contract.mjs";

// Load environment variables
dotenv.config();

class AirlinePortalFlightBookingAutomation {
  private stagehand!: Stagehand;
  private config: BookingConfig;
  private agent: any;

  constructor(config: BookingConfig) {
    this.config = config;

    // Initialize Stagehand with clean logging
  }

  async searchFlights(): Promise<FlightSearchResult> {
    validateBookingConfig(this.config);
    this.stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse({
        browser: await browserbase.launch({
          apiKey: process.env.BROWSERBASE_API_KEY!,
          ...{
            proxies: true,
            browserSettings: {
              verified: true,
            },
          },
        }),
      }),
    );
    const startTime = Date.now();

    try {
      logProgress("🚀 Starting AirlinePortal flight search automation...");

      logProgress("✅ Configuration validated");

      // Initialize Stagehand

      logProgress("✅ Stagehand initialized");

      // Initialize agent for better field interactions
      this.agent = async (task: Parameters<typeof runBrowserTask>[1]) => {
        const outcome = await runBrowserTask(this.stagehand, task, {
          instructions:
            "You are a helpful assistant that helps users navigate the AirlinePortal website to search for flights. " +
            "Follow the instructions precisely and do not ask follow up questions. " +
            "When filling form fields, make sure to interact with the correct elements and wait for any dropdown suggestions to appear before selecting options.",
        });
        if (!outcome.completed) {
          throw new Error(`Browser task did not complete: ${outcome.output}`);
        }
        return outcome;
      };
      logProgress("✅ Agent initialized");

      await this.initializePage();
      await this.handleCookieConsent();
      await this.fillBookingForm();
      await this.initiateSearch();

      const flightData = await this.extractFlightResults();

      const searchDuration = calculateDuration(startTime, Date.now());
      flightData.searchDuration = searchDuration;

      logProgress(`✅ Flight search completed in ${searchDuration}`);

      // Validate extracted data
      const validatedData = FlightSearchResultSchema.parse(flightData);
      assertFlightResultMatchesRequest(validatedData, this.config);

      return validatedData;
    } catch (error) {
      const searchDuration = calculateDuration(startTime, Date.now());
      logProgress(`❌ Flight search failed after ${searchDuration}`);

      if (error instanceof AirlinePortalAutomationError) {
        throw error;
      }

      throw new AirlinePortalAutomationError(
        "Flight search automation failed",
        "AUTOMATION_ERROR",
        { error: error instanceof Error ? error.message : error },
      );
    } finally {
      await this.cleanup();
    }
  }

  private async initializePage(): Promise<void> {
    logProgress("🌐 Navigating to AirlinePortal.com...");

    await retryOperation(async () => {
      await (await this.stagehand.browser.context.activePage())!.goto(
        "https://airline_portal.com",
        {
          waitUntil: "networkidle",
        },
      );
    });

    // Wait for page to fully load
    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      3000,
    );
    logProgress("✅ Page loaded successfully");
  }

  private async handleCookieConsent(): Promise<void> {
    logProgress("🍪 Handling cookie consent...");

    try {
      await retryOperation(
        async () => {
          await this.stagehand.act(
            "Accept cookies by clicking the accept button in the cookie consent popup if it appears",
            { page: (await this.stagehand.browser.context.activePage())! },
          );
        },
        2,
        1000,
      );

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        2000,
      );
      logProgress("✅ Cookie consent handled");
    } catch (error) {
      logProgress("⚠️ No cookie consent popup found or already handled");
    }
  }

  private async fillBookingForm(): Promise<void> {
    logProgress("📝 Filling booking form...");

    const {
      origin,
      destination,
      departureDate,
      returnDate,
      passengers,
      tripType,
    } = this.config;

    // Set trip type using agent
    if (tripType === "return") {
      await this.agent(
        "Find and select the 'Return' or 'Round trip' option on the flight booking form",
      );
    } else {
      await this.agent(
        "Find and select the 'One way' option on the flight booking form",
      );
    }

    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      1000,
    );

    // Fill origin airport using agent with detailed instructions
    logProgress(`🛫 Setting origin: ${origin} (${getAirportName(origin)})`);
    await retryOperation(async () => {
      await this.agent(
        `Fill out the departure/origin airport field on the AirlinePortal booking form. Follow these steps:
        1. Click on the departure/origin airport input field
        2. Clear any existing text in the field
        3. Type the airport code "${origin}"
        4. Wait for dropdown suggestions to appear
        5. Look for and click on the option that shows "${origin}" or "${getAirportName(origin)}"
        6. Make sure the field is properly filled with the selected airport`,
      );
    });

    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      2000,
    );

    // Fill destination airport using agent with detailed instructions
    logProgress(
      `🛬 Setting destination: ${destination} (${getAirportName(destination)})`,
    );
    await retryOperation(async () => {
      await this.agent(
        `Fill out the arrival/destination airport field on the AirlinePortal booking form. Follow these steps:
        1. Click on the arrival/destination airport input field
        2. Clear any existing text in the field
        3. Type the airport code "${destination}"
        4. Wait for dropdown suggestions to appear
        5. Look for and click on the option that shows "${destination}" or "${getAirportName(destination)}"
        6. Make sure the field is properly filled with the selected airport`,
      );
    });

    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      2000,
    );

    // Set departure date using agent
    const formattedDepartureDate = formatDateForAirlinePortal(departureDate);
    logProgress(`📅 Setting departure date: ${formattedDepartureDate}`);
    await retryOperation(async () => {
      await this.agent(
        `Fill out the departure date field on the AirlinePortal booking form. Follow these steps:
        1. Click on the departure date field or calendar icon
        2. Navigate to and select the date ${formattedDepartureDate} (${departureDate})
        3. Make sure the selected date is visible in the departure date field
        4. Close any date picker if it remains open`,
      );
    });

    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      1000,
    );

    // Set return date if return trip using agent
    if (tripType === "return" && returnDate) {
      const formattedReturnDate = formatDateForAirlinePortal(returnDate);
      logProgress(`📅 Setting return date: ${formattedReturnDate}`);
      await retryOperation(async () => {
        await this.agent(
          `Fill out the return date field on the AirlinePortal booking form. Follow these steps:
          1. Click on the return date field or calendar icon
          2. Navigate to and select the date ${formattedReturnDate} (${returnDate})
          3. Make sure the selected date is visible in the return date field
          4. Close any date picker if it remains open`,
        );
      });

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1000,
      );
    }

    // Set passenger count using agent
    if (passengers > 1) {
      logProgress(`👥 Setting passengers: ${passengers}`);
      await retryOperation(async () => {
        await this.agent(
          `Set the number of passengers on the AirlinePortal booking form. Follow these steps:
          1. Find and click on the passengers field or passenger selector
          2. Adjust the passenger count to ${passengers} passengers
          3. Make sure the passenger count shows ${passengers} in the form
          4. Close any passenger selection dropdown if it remains open`,
        );
      });

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1000,
      );
    }

    logProgress("✅ Booking form completed");
  }

  private async initiateSearch(): Promise<void> {
    logProgress("🔍 Initiating flight search...");

    await retryOperation(async () => {
      await this.agent(
        `Find and click the search button to start the flight search. The button might be labeled as:
        - 'Start booking'
        - 'Search flights'
        - 'Find flights'
        - 'Search'
        Make sure to click the main search/submit button on the flight booking form.`,
      );
    });

    // Wait for search results to load
    logProgress("⏳ Waiting for search results...");
    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      5000,
    );

    // Check if results loaded
    (
      await this.stagehand.observe(
        "Check if flight search results have loaded on the page",
        { page: (await this.stagehand.browser.context.activePage())! },
      )
    ).data;

    logProgress("✅ Search initiated successfully");
  }

  private async extractFlightResults(): Promise<FlightSearchResult> {
    logProgress("📊 Extracting flight data...");

    const extractionInstruction = `
      Extract all available flight information from this AirlinePortal search results page and return it as a JSON object with this exact structure:
      {
        "searchCriteria": {
          "origin": "${this.config.origin}",
          "destination": "${this.config.destination}",
          "departureDate": "${this.config.departureDate}",
          "returnDate": "${this.config.returnDate || ""}",
          "passengers": ${this.config.passengers},
          "tripType": "${this.config.tripType}"
        },
        "outboundFlights": [
          {
            "flightNumber": "W6 1234",
            "departureTime": "08:30",
            "arrivalTime": "10:45",
            "departureAirport": "${this.config.origin}",
            "arrivalAirport": "${this.config.destination}",
            "duration": "2h 15m",
            "aircraft": "Airbus A320",
            "price": {
              "amount": 89.99,
              "currency": "EUR",
              "fareType": "WIZZ Basic"
            },
            "availability": {
              "seatsAvailable": true,
              "bookingClass": "Economy"
            }
          }
        ],
        "returnFlights": [],
        "totalResults": 0
      }
      
      Include ALL visible flights with their actual times, prices, and details. If no flights are found, set totalResults to 0 and empty arrays for flights.
    `;

    const rawFlightData = await retryOperation(async () => {
      return (
        await this.stagehand.extract(extractionInstruction, {
          page: (await this.stagehand.browser.context.activePage())!,
        })
      ).data;
    });

    const processedData = processFlightData(rawFlightData);

    logProgress(`✅ Extracted ${processedData.totalResults} flight options`);

    return processedData;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.stagehand) {
        await this.stagehand.close();
        await this.stagehand.browser.close();
      }
      logProgress("✅ Cleanup completed");
    } catch (error) {
      logProgress("⚠️ Cleanup warning:", error);
    }
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    // Configuration from environment variables
    const config: BookingConfig = {
      origin: process.env.ORIGIN_AIRPORT || "BUD",
      destination: process.env.DESTINATION_AIRPORT || "LTN",
      departureDate: process.env.DEPARTURE_DATE || "",
      returnDate: process.env.RETURN_DATE,
      passengers: parseInt(process.env.PASSENGERS || "1"),
      tripType: (process.env.TRIP_TYPE as "oneway" | "return") || "return",
    };

    logProgress("🎯 AirlinePortal Flight Booking Automation Demo");
    logProgress(
      "📍 Route: " +
        getAirportName(config.origin) +
        " → " +
        getAirportName(config.destination),
    );
    logProgress(
      "📅 Dates: " +
        config.departureDate +
        (config.returnDate ? " → " + config.returnDate : ""),
    );
    logProgress("👥 Passengers: " + config.passengers);
    logProgress("✈️ Trip Type: " + config.tripType.toUpperCase());

    const automation = new AirlinePortalFlightBookingAutomation(config);
    const results = await automation.searchFlights();

    // Output results
    console.log("\n" + "=".repeat(50));
    console.log("🎉 FLIGHT SEARCH RESULTS");
    console.log("=".repeat(50));
    console.log(JSON.stringify(results, null, 2));

    // Summary
    console.log("\n📋 SUMMARY:");
    console.log(
      `• Route: ${results.searchCriteria.origin} → ${results.searchCriteria.destination}`,
    );
    console.log(`• Departure: ${results.searchCriteria.departureDate}`);
    if (results.searchCriteria.returnDate) {
      console.log(`• Return: ${results.searchCriteria.returnDate}`);
    }
    console.log(
      `• Outbound flights found: ${results.outboundFlights?.length || 0}`,
    );
    if (results.returnFlights) {
      console.log(`• Return flights found: ${results.returnFlights.length}`);
    }
    console.log(`• Search completed in: ${results.searchDuration}`);

    // Show cheapest option if available
    if (results.outboundFlights && results.outboundFlights.length > 0) {
      const cheapestFlight = results.outboundFlights.reduce((prev, current) =>
        prev.price.amount < current.price.amount ? prev : current,
      );

      console.log("\n💰 CHEAPEST OUTBOUND FLIGHT:");
      console.log(
        `• ${cheapestFlight.flightNumber}: ${cheapestFlight.departureTime} - ${cheapestFlight.arrivalTime}`,
      );
      console.log(
        `• Price: ${cheapestFlight.price.amount} ${cheapestFlight.price.currency} (${cheapestFlight.price.fareType})`,
      );
      console.log(`• Duration: ${cheapestFlight.duration}`);
    }
  } catch (error) {
    console.error("\n❌ AUTOMATION FAILED:");

    if (error instanceof AirlinePortalAutomationError) {
      console.error(`• Error Code: ${error.code}`);
      console.error(`• Message: ${error.message}`);
      if (error.details) {
        console.error("• Details:", JSON.stringify(error.details, null, 2));
      }
    } else {
      console.error("• Unexpected error:", error);
    }

    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AirlinePortalFlightBookingAutomation };

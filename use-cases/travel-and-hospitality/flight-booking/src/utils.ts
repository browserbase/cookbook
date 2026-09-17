import {
  BookingConfig,
  FlightSearchResult,
  AirlinePortalAutomationError,
} from "./types";

/**
 * Parse date string to ensure proper format for AirlinePortal
 */
export function formatDateForAirlinePortal(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new AirlinePortalAutomationError("Invalid date format", "INVALID_DATE", {
      providedDate: dateString,
    });
  }

  // Format as YYYY-MM-DD
  return date.toISOString().split("T")[0];
}

/**
 * Generate human-readable airport names from codes
 */
export function getAirportName(code: string): string {
  const airportNames: Record<string, string> = {
    BUD: "Budapest Ferenc Liszt International",
    LTN: "London Luton",
    BCN: "Barcelona El Prat",
    ROM: "Rome Fiumicino",
    PRG: "Prague Václav Havel",
    VIE: "Vienna International",
    WAW: "Warsaw Chopin",
    ATH: "Athens International",
  };

  return airportNames[code] || code;
}

/**
 * Validate booking configuration
 */
export function validateBookingConfig(config: BookingConfig): void {
  const errors: string[] = [];

  if (!config.origin || config.origin.length !== 3) {
    errors.push("Origin airport code must be 3 characters");
  }

  if (!config.destination || config.destination.length !== 3) {
    errors.push("Destination airport code must be 3 characters");
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const departureDate = new Date(`${config.departureDate}T00:00:00Z`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!datePattern.test(config.departureDate) || Number.isNaN(departureDate.getTime())) {
    errors.push("Departure date must be a valid YYYY-MM-DD date");
  } else if (departureDate <= today) {
    errors.push("Departure date must be in the future");
  }

  if (config.tripType === "return") {
    if (!config.returnDate) {
      errors.push("Return date is required for return trips");
    } else {
      const returnDate = new Date(`${config.returnDate}T00:00:00Z`);
      if (!datePattern.test(config.returnDate) || Number.isNaN(returnDate.getTime())) {
        errors.push("Return date must be a valid YYYY-MM-DD date");
      } else if (returnDate <= departureDate) {
        errors.push("Return date must be after departure date");
      }
    }
  }

  if (!Number.isInteger(config.passengers) || config.passengers < 1 || config.passengers > 9) {
    errors.push("Passengers must be between 1 and 9");
  }

  if (errors.length > 0) {
    throw new AirlinePortalAutomationError(
      "Invalid booking configuration",
      "CONFIG_VALIDATION_ERROR",
      { errors },
    );
  }
}

/**
 * Clean and format extracted flight data
 */
export function processFlightData(rawData: any): FlightSearchResult {
  try {
    // Parse the extraction result structure from Stagehand
    const extractionData =
      typeof rawData.extraction === "string"
        ? JSON.parse(rawData.extraction)
        : rawData.extraction || rawData;

    // Add metadata
    extractionData.searchTimestamp = new Date().toISOString();

    return extractionData;
  } catch (error) {
    throw new AirlinePortalAutomationError(
      "Failed to process flight data",
      "DATA_PROCESSING_ERROR",
      { rawData, error: error instanceof Error ? error.message : error },
    );
  }
}

/**
 * Calculate search duration
 */
export function calculateDuration(startTime: number, endTime: number): string {
  const duration = (endTime - startTime) / 1000;
  return `${duration.toFixed(2)}s`;
}

/**
 * Log progress with clean formatting
 */
export function logProgress(message: string, data?: any): void {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);

  if (data && process.env.DEBUG === "true") {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Handle retry logic for automation steps
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      logProgress(
        `Retry attempt ${attempt}/${maxRetries} failed, waiting ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Max retries exceeded");
}

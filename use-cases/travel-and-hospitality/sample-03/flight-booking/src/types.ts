import { z } from "zod";

// Flight data schema using Zod for validation
export const FlightSchema = z.object({
  flightNumber: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  duration: z.string(),
  aircraft: z.string().optional(),
  price: z.object({
    amount: z.number(),
    currency: z.string(),
    fareType: z.string(),
  }),
  availability: z.object({
    seatsAvailable: z.boolean(),
    bookingClass: z.string(),
  }),
});

export const FlightSearchResultSchema = z.object({
  searchCriteria: z.object({
    origin: z.string(),
    destination: z.string(),
    departureDate: z.string(),
    returnDate: z.string().optional(),
    passengers: z.number(),
    tripType: z.enum(["oneway", "return"]),
  }),
  outboundFlights: z.array(FlightSchema),
  returnFlights: z.array(FlightSchema).optional(),
  searchTimestamp: z.string(),
  totalResults: z.number(),
  searchDuration: z.string(),
});

export type Flight = z.infer<typeof FlightSchema>;
export type FlightSearchResult = z.infer<typeof FlightSearchResultSchema>;

// Configuration interface
export interface BookingConfig {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  tripType: "oneway" | "return";
}

// Error types for better error handling
export class AirlinePortalAutomationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = "AirlinePortalAutomationError";
  }
}

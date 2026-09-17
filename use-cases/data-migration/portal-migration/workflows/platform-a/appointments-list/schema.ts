import { z } from "zod";

/**
 * Typed output for the appointments pull. Mirrors the normalized reservation shape the prompt
 * defines, so the agent's "return JSON" result is captured to <short>.output.json (not just narrated
 * in the trace message). `raw` is included to match the prompt — drop it here to slim the output.
 */
const reservation = z.object({
  id: z.string(),
  status: z.string(),
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  clientPhone: z.string().nullable(),
  dateStart: z.string(),
  dateEnd: z.string(),
  durationMins: z.number().nullable(),
  timezone: z.string().nullable(),
  serviceNames: z.array(z.string()),
  staffNames: z.array(z.string()),
  staffTokens: z.array(z.string()),
  locationName: z.string().nullable(),
  locationType: z.string().nullable(),
  rrule: z.string().nullable(),
  parentId: z.string().nullable(),
  exdates: z.unknown().optional(),
  buyerNote: z.string().nullable(),
  sellerNote: z.string().nullable(),
  totalMoney: z.record(z.string(), z.unknown()).nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export default z.object({
  dateWindow: z.object({
    start: z.string(),
    end: z.string(),
    timezoneOrOffset: z.string(),
  }),
  businessLocationId: z.string(),
  staffIdsQueried: z.array(z.string()),
  reservationCount: z.number().describe("Number of reservations returned"),
  reservations: z.array(reservation),
});

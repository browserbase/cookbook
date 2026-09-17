import { z } from "zod/v4";
import { parseCalendarDate } from "./calendar-dates.js";

const text = z.string().trim().min(1);
const date = text.refine(value => {
  try { parseCalendarDate(value); return true; } catch { return false; }
}, "Expected a valid YYYY-MM-DD calendar date");
const time = text.regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const bookingIntentSchema = z.object({
  activity: z.enum(["Tennis", "Pickleball"]),
  date,
  timeOfDay: z.enum(["Morning", "Afternoon", "Evening"]),
});
export const reviewedBookingSchema = bookingIntentSchema.omit({ timeOfDay: true }).extend({
  court: text, facility: text, start: time, end: time, participant: text, price: text,
});
export const bookingReceiptSchema = reviewedBookingSchema.extend({
  reservationId: text,
  confirmed: z.boolean(),
  errorMessage: z.string().nullable(),
  visibleReceiptText: text,
});
export type BookingIntent = z.infer<typeof bookingIntentSchema>;
export type ReviewedBooking = z.infer<typeof reviewedBookingSchema> & Pick<BookingIntent, "timeOfDay">;
export type BookingReceipt = z.infer<typeof bookingReceiptSchema> & Pick<BookingIntent, "timeOfDay">;

export function validateBookingIntent(value: unknown): BookingIntent {
  return bookingIntentSchema.parse(value);
}

export function validateReviewedBooking(value: unknown, requested: BookingIntent): ReviewedBooking {
  const intent = validateBookingIntent(requested);
  const booking = reviewedBookingSchema.parse(value);
  if (booking.date !== intent.date || booking.activity !== intent.activity) {
    throw new Error("The selected reservation does not match the requested date, activity, and time period");
  }
  if (booking.end <= booking.start) throw new Error("Reservation end must follow its start on the same date");
  const matchesTime = intent.timeOfDay === "Morning" ? booking.start < "12:00"
    : intent.timeOfDay === "Afternoon" ? booking.start >= "12:00" : booking.start >= "17:00";
  if (!matchesTime) throw new Error("The selected reservation is outside the requested time period");
  return { ...booking, timeOfDay: intent.timeOfDay };
}

export function validateBookingReceipt(
  value: unknown, reviewed: ReviewedBooking, previousReservationId: string | null,
): BookingReceipt {
  const receipt = bookingReceiptSchema.parse(value);
  if (receipt.errorMessage?.trim()) throw new Error(`Booking rejected: ${receipt.errorMessage.trim()}`);
  if (!receipt.confirmed) throw new Error("Booking outcome is unknown: receipt is not confirmed");
  const expected = validateReviewedBooking(reviewed, reviewed);
  validateReviewedBooking(receipt, expected);
  for (const field of ["court", "facility", "start", "end", "participant", "price"] as const) {
    if (receipt[field] !== expected[field]) throw new Error(`Booking outcome is unknown: receipt ${field} differs from the reviewed reservation`);
  }
  if (previousReservationId !== null && receipt.reservationId === text.parse(previousReservationId)) {
    throw new Error("Booking outcome is unknown: the reservation identifier was already present before submission");
  }
  // Structured model output is not independent proof of the server-side reservation.
  return { ...receipt, timeOfDay: expected.timeOfDay };
}

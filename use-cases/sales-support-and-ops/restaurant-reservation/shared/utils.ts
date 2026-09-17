/**
 * Shared utility functions for reservation portal automation
 */

/**
 * Strip screenshots from agent actions to stay under 64KB result limit
 */
export function stripScreenshots(actions: any[]): any[] {
  return actions.map((action) => {
    const { screenshot, ...rest } = action;
    return rest;
  });
}

/**
 * Validate date string in YYYY-MM-DD format
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Normalize time string to 24-hour format
 * Handles formats like "7:00 PM", "19:00", "7 PM"
 */
export function normalizeTime(timeString: string): string {
  const time = timeString.trim().toUpperCase();

  // If already in 24-hour format (HH:MM), return as-is
  if (
    /^\d{1,2}:\d{2}$/.test(time) &&
    !time.includes("AM") &&
    !time.includes("PM")
  ) {
    return time;
  }

  // Parse AM/PM format
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (!match) return time; // Return original if can't parse

  let hours = parseInt(match[1]);
  const minutes = match[2] || "00";
  const period = match[3];

  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

/**
 * Format phone number for reservation portal forms
 * Removes non-numeric characters and formats as needed
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // Return cleaned version if not standard length
  return cleaned;
}

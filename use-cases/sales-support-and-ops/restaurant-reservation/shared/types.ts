/**
 * Shared TypeScript interfaces for reservation portal automation functions
 */

export interface TimeSlot {
  time: string;
  bookingUrl: string;
  notes?: string;
}

export interface Restaurant {
  name: string;
  cuisine: string;
  priceRange: string;
  rating: string;
  address: string;
  availableSlots: TimeSlot[];
}

export interface SearchCriteria {
  location: string;
  date: string;
  time: string;
  partySize: number;
  cuisineOrType?: string;
}

export interface RestaurantInfo {
  name: string;
  address: string;
  phone: string;
}

export interface ReservationDetails {
  date: string;
  time: string;
  partySize: number;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone: string;
}

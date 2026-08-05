/**
 * Admin data - cleared (no demo data).
 */

export const adminAlerts = [];
export const adminVenues = [];

export function findVenue(venueId) {
  return adminVenues.find((venue) => venue.id === venueId) ?? null;
}

import assert from "node:assert/strict";
import test from "node:test";
import { assertFlightResultMatchesRequest } from "../src/flight-result-contract.mjs";

const request = {
  origin: "BUD",
  destination: "LTN",
  departureDate: "2030-10-10",
  returnDate: "2030-10-12",
  passengers: 1,
  tripType: "return",
};

function result() {
  return {
    searchCriteria: { ...request },
    outboundFlights: [{ departureAirport: "BUD", arrivalAirport: "LTN" }],
    returnFlights: [{ departureAirport: "LTN", arrivalAirport: "BUD" }],
    totalResults: 2,
  };
}

test("accepts an exact route and count", () => {
  assert.equal(
    assertFlightResultMatchesRequest(result(), request).totalResults,
    2,
  );
});

test("rejects extracted criteria for another route", () => {
  const candidate = result();
  candidate.searchCriteria.destination = "LGW";
  assert.throws(
    () => assertFlightResultMatchesRequest(candidate, request),
    /destination/,
  );
});

test("rejects a flight whose airports contradict the route", () => {
  const candidate = result();
  candidate.outboundFlights[0].arrivalAirport = "LGW";
  assert.throws(
    () => assertFlightResultMatchesRequest(candidate, request),
    /Outbound/,
  );
});

test("rejects a total that contradicts the flight arrays", () => {
  const candidate = result();
  candidate.totalResults = 9;
  assert.throws(
    () => assertFlightResultMatchesRequest(candidate, request),
    /contradicts/,
  );
});
